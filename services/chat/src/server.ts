import Fastify, { FastifyError } from "fastify";
import fs from "node:fs";
import process from "node:process";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { FriendSocketEvent, SendDirectMessagePayload } from "shared";
import prismaPlugin from "./plugins/prisma.js";
import messageHistoryRoutes from "./routes/message_history.js";
import {
  isSessionCurrent,
  jwtSecretOrExit,
  setupMetrics,
  setupOriginCheck,
  isSameOrigin,
  createMessageLimiter,
} from "shared";
import type { SessionPayload } from "shared";

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
const ALLOWED_FRIEND_EVENTS = new Set([
  "friend_request_received",
  "friend_request_accepted",
  "friend_removed",
]);

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
// Writes sent from another website are refused (security audit F-25)
setupOriginCheck(fastify);

// Every open socket of a user: one per tab or device
export const connectedClients = new Map<string, Set<WebSocket>>();

// Sends to every open socket of the user, returns true if one got it
function sendToUser(userId: string, data: string): boolean {
  let delivered = false;
  for (const ws of connectedClients.get(userId) ?? []) {
    if (ws.readyState === 1) {
      ws.send(data);
      delivered = true;
    }
  }
  return delivered;
}

fastify.register(cookie);
// The JWT key: without it in production the service refuses to start,
// instead of signing with a key everybody knows
function jwtSecret(): string {
  return jwtSecretOrExit(process.env.JWT_SECRET);
}

fastify.register(jwt, {
  secret: jwtSecret(),
  cookie: {
    cookieName: "access_token",
    signed: false,
  },
  // Revoked sessions are refused (security audit F-07)
  trusted: (_request, decoded) =>
    isSessionCurrent(fastify.prisma, decoded as SessionPayload),
});
// Trames bornees : un message fait 2000 caracteres au plus (audit F-22)
fastify.register(websocket, { options: { maxPayload: 16 * 1024 } });
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

// Internal service-to-service endpoint (blocked from public gateway in nginx.conf)
// Allows user-service to push real-time friend events onto an active user's WebSocket
fastify.post("/internal/events", async (request, reply) => {
  const body = request.body as {
    targetUserId?: unknown;
    event?: FriendSocketEvent;
  } | null;

  if (
    !body ||
    typeof body.targetUserId !== "string" ||
    !UUID_REGEX.test(body.targetUserId) ||
    !body.event ||
    typeof body.event.type !== "string" ||
    !ALLOWED_FRIEND_EVENTS.has(body.event.type)
  ) {
    return reply.code(400).send({ error: "Invalid internal event payload" });
  }

  const delivered = sendToUser(body.targetUserId, JSON.stringify(body.event));
  return reply.send({ delivered });
});

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, async (socket: WebSocket, req) => {
    // Handshake from a page of another website: refused (audit F-23)
    if (!isSameOrigin(req.headers.origin, req.headers.host)) {
      socket.close(1008, "Cross-site connection refused");
      return;
    }
    // Flood protection on this socket: every message is written to the
    // database, so bursts of 20, then 5 per second (audit F-10)
    const allowMessage = createMessageLimiter(5, 20);

    const query = req.query as { token?: string };
    const token = query?.token ?? req.cookies?.access_token;

    if (!token) {
      fastify.log.warn("WS connection rejected: missing token");
      socket.close(1008, "Token missing");
      return;
    }

    let userId: string;
    let tokenVersion: number | undefined;
    try {
      const decoded = fastify.jwt.verify<{ id: string; v?: number }>(token);
      userId = decoded.id;
      tokenVersion = decoded.v;
    } catch (err) {
      fastify.log.warn({ err }, "WS connection rejected: invalid token");
      socket.close(1008, "Invalid token");
      return;
    }

    // Messages arriving during the session check are kept, then replayed
    const early: Buffer[] = [];
    const keep = (message: Buffer) => early.push(message);
    socket.on("message", keep);

    // Revoked session (logout, password or 2FA change): refused like an
    // invalid token (security audit F-07)
    let current = false;
    try {
      current = await isSessionCurrent(fastify.prisma, {
        id: userId,
        v: tokenVersion,
      });
    } catch (err) {
      fastify.log.error({ err, userId }, "Session check failed");
    }
    if (!current) {
      socket.close(1008, "Invalid token");
      return;
    }

    // The client may have left during the check: its close is already past
    if (socket.readyState !== 1) return;

    // Prevent unhandled 'error' events on abrupt client disconnects from crashing Node
    socket.on("error", (err) => {
      fastify.log.warn({ err, userId }, "WebSocket client error");
    });

    fastify.log.info(`User authenticated on WS: ${userId}`);
    if (!connectedClients.has(userId)) connectedClients.set(userId, new Set());
    connectedClients.get(userId)!.add(socket);

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

    socket.on("message", (rawMessage: Buffer) => {
      // Filet de securite : aucune erreur d'un message ne doit tuer le service
      handleMessage(rawMessage).catch((err) => {
        fastify.log.error({ err, userId }, "Chat message handler failed");
        if (socket.readyState === 1)
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Failed to send message",
            }),
          );
      });
    });
    socket.off("message", keep);
    for (const message of early) socket.emit("message", message);

    async function handleMessage(rawMessage: Buffer): Promise<void> {
      if (!allowMessage()) {
        socket.send(
          JSON.stringify({ type: "error", message: "Too many messages" }),
        );
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMessage.toString());
      } catch {
        socket.send(
          JSON.stringify({ type: "error", message: "Invalid JSON format" }),
        );
        return;
      }

      // JSON valide mais pas un objet (null, tableau, nombre...) : avant ce
      // test, "null" faisait planter tout le service (audit F-01)
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        socket.send(
          JSON.stringify({ type: "error", message: "Invalid message payload" }),
        );
        return;
      }

      const { type, receiverId, content, messageType, gameRoomId } =
        parsed as Record<string, unknown>;
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

        // Messages directs entre amis seulement : l'interface ne propose le
        // chat qu'aux amis, le serveur doit l'imposer aussi (audit F-11)
        const friendship = await fastify.prisma.friendship.findFirst({
          where: {
            status: "accepted",
            OR: [
              { userId, friendId: payload.receiverId },
              { userId: payload.receiverId, friendId: userId },
            ],
          },
          select: { id: true },
        });
        if (!friendship) {
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Cannot send message: you are not friends",
            }),
          );
          return;
        }

        const isRecipientOnline = [
          ...(connectedClients.get(payload.receiverId) ?? []),
        ].some((ws) => ws.readyState === 1);

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

        sendToUser(payload.receiverId, outboundString);
        // Every tab of the sender shows the message too
        sendToUser(userId, outboundString);
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
    }

    socket.on("close", () => {
      const sockets = connectedClients.get(userId);
      sockets?.delete(socket);
      if (sockets?.size === 0) connectedClients.delete(userId);
      fastify.log.info(`User disconnected: ${userId}`);
    });
  });
});

// Derniere ligne de defense : une erreur oubliee est journalisee au lieu
// d'arreter le service (audit F-01)
process.on("unhandledRejection", (reason) => {
  fastify.log.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  fastify.log.error({ err }, "Uncaught exception");
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
