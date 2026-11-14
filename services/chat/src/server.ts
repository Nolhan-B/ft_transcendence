import Fastify, { FastifyError } from "fastify";
import fs from "node:fs";
import process from "node:process";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { SendDirectMessagePayload } from "shared";
import prismaPlugin from "./plugins/prisma.js";
import messageHistoryRoutes from "./routes/message_history.js";
import { setupMetrics } from "shared";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

if (fs.existsSync("/run/secrets/jwt_secret")) {
  process.env.JWT_SECRET = fs
    .readFileSync("/run/secrets/jwt_secret", "utf-8")
    .trim();
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_ROOM_ID_LENGTH = 100;

const fastify = Fastify({
  logger: true,
});

// Global HTTP error handler to map Prisma/Fastify errors cleanly and prevent stack trace leaks
fastify.setErrorHandler(
  (error: FastifyError & { code?: string }, request, reply) => {
    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Resource already exists" });
    }
    if (error.code === "P2025") {
      return reply.code(404).send({ error: "Resource not found" });
    }
    if (error.code === "P2003") {
      return reply
        .code(409)
        .send({ error: "Cannot complete operation due to related records" });
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        error: error.name,
        message: error.message,
      });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  },
);

setupMetrics(fastify, "chat-services");

export const connectedClients = new Map<string, WebSocket>();

fastify.register(cookie);
fastify.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret",
  cookie: {
    cookieName: "access_token",
    signed: false,
  },
});
fastify.register(websocket);
fastify.register(prismaPlugin);
fastify.register(messageHistoryRoutes);

fastify.get("/", async () => {
  return { service: "chat", status: "ok" };
});

fastify.route({
  method: ["GET", "HEAD"],
  url: "/health",
  logLevel: "silent",
  handler: async () => ({ service: "chat", status: "ok" }),
});

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as { token?: string };
    const token = query?.token ?? req.cookies?.access_token;

    if (!token) {
      fastify.log.warn("WS connection rejected: missing token");
      socket.close(1008, "Token missing");
      return;
    }

    let userId: string;
    try {
      const decoded = fastify.jwt.verify<{ id: string; email: string }>(token);
      userId = decoded.id;
    } catch (err) {
      fastify.log.warn({ err }, "WS connection rejected: invalid token");
      socket.close(1008, "Invalid token");
      return;
    }

    // Prevent unhandled 'error' events on abrupt client disconnects from crashing Node
    socket.on("error", (err) => {
      fastify.log.warn({ err, userId }, "WebSocket client error");
    });

    fastify.log.info(`User authenticated on WS: ${userId}`);
    connectedClients.set(userId, socket);

    // Deliver offline queued messages upon connection
    (async () => {
      try {
        const pendingMessages = await fastify.prisma.directMessage.findMany({
          where: { receiverId: userId, delivered: false },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            messageType: true,
            gameRoomId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        });

        if (pendingMessages.length === 0) return;

        for (const msg of pendingMessages) {
          if (socket.readyState !== 1) return;
          socket.send(
            JSON.stringify({
              type: "direct_message",
              id: msg.id,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              content: msg.content,
              messageType: msg.messageType,
              gameRoomId: msg.gameRoomId,
              createdAt: msg.createdAt.toISOString(),
            }),
          );
        }

        await fastify.prisma.directMessage.updateMany({
          where: { id: { in: pendingMessages.map((m) => m.id) } },
          data: { delivered: true },
        });
      } catch (err) {
        fastify.log.error({ err }, "Failed to deliver pending messages");
      }
    })();

    socket.on("message", async (rawMessage: Buffer) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawMessage.toString());
      } catch {
        socket.send(
          JSON.stringify({ type: "error", message: "Invalid JSON format" }),
        );
        return;
      }

      const { type, receiverId, content, messageType, gameRoomId } = parsed;
      if (
        type !== "direct_message" ||
        typeof receiverId !== "string" ||
        !UUID_REGEX.test(receiverId) ||
        typeof content !== "string" ||
        content.trim() === "" ||
        content.length > MAX_MESSAGE_LENGTH
      ) {
        socket.send(
          JSON.stringify({ type: "error", message: "Invalid message payload" }),
        );
        return;
      }

      // Validate gameRoomId as a bounded string without enforcing UUID format
      if (
        gameRoomId !== undefined &&
        gameRoomId !== null &&
        (typeof gameRoomId !== "string" ||
          gameRoomId.length > MAX_ROOM_ID_LENGTH)
      ) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid gameRoomId format",
          }),
        );
        return;
      }

      const payload: SendDirectMessagePayload = {
        type,
        receiverId,
        content,
        messageType: messageType === "game_invite" ? "game_invite" : "text",
        gameRoomId:
          typeof gameRoomId === "string" && gameRoomId.trim() !== ""
            ? gameRoomId.trim()
            : undefined,
      };

      if (payload.receiverId === userId) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Cannot send message to yourself",
          }),
        );
        return;
      }

      // Wrap all database calls inside try/catch to prevent unhandled promise rejections
      try {
        const blockRelation = await fastify.prisma.blockedFriendship.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: payload.receiverId },
              { blockerId: payload.receiverId, blockedId: userId },
            ],
          },
        });

        if (blockRelation) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Cannot send message: user is blocked",
            }),
          );
          return;
        }

        const recipientSocket = connectedClients.get(payload.receiverId);
        const isRecipientOnline =
          recipientSocket !== undefined && recipientSocket.readyState === 1;

        const savedMessage = await fastify.prisma.directMessage.create({
          data: {
            senderId: userId,
            receiverId: payload.receiverId,
            content: payload.content.trim(),
            messageType: payload.messageType ?? "text",
            gameRoomId: payload.gameRoomId ?? null,
            delivered: isRecipientOnline,
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            messageType: true,
            gameRoomId: true,
            createdAt: true,
          },
        });

        const outboundString = JSON.stringify({
          type: "direct_message",
          id: savedMessage.id,
          senderId: savedMessage.senderId,
          receiverId: savedMessage.receiverId,
          content: savedMessage.content,
          messageType: savedMessage.messageType,
          gameRoomId: savedMessage.gameRoomId,
          createdAt: savedMessage.createdAt.toISOString(),
        });

        if (isRecipientOnline && recipientSocket) {
          recipientSocket.send(outboundString);
        }

        if (socket.readyState === 1) {
          socket.send(outboundString);
        }
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        // Handle foreign key violation when sender or recipient no longer exists
        if (prismaError.code === "P2003") {
          socket.send(
            JSON.stringify({ type: "error", message: "Recipient not found" }),
          );
          return;
        }
        fastify.log.error({ err }, "Failed to process direct message");
        socket.send(
          JSON.stringify({ type: "error", message: "Failed to send message" }),
        );
      }
    });

    socket.on("close", () => {
      if (connectedClients.get(userId) === socket) {
        connectedClients.delete(userId);
      }
      fastify.log.info(`User disconnected: ${userId}`);
    });
  });
});

const start = async () => {
  try {
    const port = Number(process.env.CHAT_PORT ?? 3003);
    await fastify.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
