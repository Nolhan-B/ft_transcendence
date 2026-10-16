import Fastify from "fastify";
import fs from "node:fs";
import process from "node:process";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { SendDirectMessagePayload } from "shared";
import prismaPlugin from "./plugins/prisma.js";
import messageHistoryRoutes from "./routes/message_history.js";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

const fastify = Fastify({
  logger: true,
});

export const connectedClients = new Map<string, WebSocket>();

fastify.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret",
});
fastify.register(websocket);
fastify.register(prismaPlugin);
fastify.register(messageHistoryRoutes);

fastify.get("/", async () => {
  return { service: "chat", status: "ok" };
});

fastify.get("/health", { logLevel: "silent" }, async () => {
  return { service: "chat", status: "ok" };
});

// IMPORTANT : Encapsuler la route WS dans register() pour attendre que @fastify/websocket soit chargé
fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as { token?: string };
    const token = query?.token;

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

    fastify.log.info(`User authenticated on WS: ${userId}`);
    connectedClients.set(userId, socket);

    // Livraison des messages en attente
    (async () => {
      try {
        const pendingMessages = await fastify.prisma.directMessage.findMany({
          where: { receiverId: userId, delivered: false },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        });

        if (pendingMessages.length === 0) return;

        for (const msg of pendingMessages) {
          if (socket.readyState !== 1) return; // 1 = OPEN
          socket.send(
            JSON.stringify({
              type: "direct_message",
              id: msg.id,
              senderId: msg.senderId,
              receiverId: msg.receiverId,
              content: msg.content,
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
        socket.send(JSON.stringify({ error: "Invalid JSON format" }));
        return;
      }

      const { type, receiverId, content } = parsed;
      if (
        type !== "direct_message" ||
        typeof receiverId !== "string" ||
        typeof content !== "string" ||
        content.trim() === ""
      ) {
        socket.send(JSON.stringify({ error: "Invalid message payload" }));
        return;
      }

      const payload: SendDirectMessagePayload = { type, receiverId, content };

      if (payload.receiverId === userId) {
        socket.send(
          JSON.stringify({ error: "Cannot send message to yourself" }),
        );
        return;
      }

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

      let savedMessage;
      try {
        savedMessage = await fastify.prisma.directMessage.create({
          data: {
            senderId: userId,
            receiverId: payload.receiverId,
            content: payload.content.trim(),
            delivered: isRecipientOnline,
          },
          select: {
            id: true,
            senderId: true,
            receiverId: true,
            content: true,
            createdAt: true,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Failed to persist direct message");
        socket.send(JSON.stringify({ error: "Failed to send message" }));
        return;
      }

      const outboundString = JSON.stringify({
        type: "direct_message",
        id: savedMessage.id,
        senderId: savedMessage.senderId,
        receiverId: savedMessage.receiverId,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt.toISOString(),
      });

      if (isRecipientOnline && recipientSocket) {
        recipientSocket.send(outboundString);
      }

      if (socket.readyState === 1) {
        socket.send(outboundString);
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
    await fastify.listen({ port: 3003, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
