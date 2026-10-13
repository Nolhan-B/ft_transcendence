import Fastify from "fastify";
import fs from "node:fs";
import process from "node:process";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { SendDirectMessagePayload } from "shared";
import prismaPlugin from "./plugins/prisma.js";

// Load database connection secret if mounted in container
if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

const fastify = Fastify({
  logger: true,
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret",
});

fastify.register(websocket);
fastify.register(prismaPlugin);

// Active WebSocket connections indexed by user ID
export const connectedClients = new Map<string, WebSocket>();

fastify.get("/", async () => {
  return { service: "chat", status: "ok" };
});

fastify.get(
  "/health",
  {
    logLevel: "silent",
  },
  async () => ({ service: "chat", status: "ok" }),
);

fastify.get("/ws", { websocket: true }, (socket, req) => {
  const query = req.query as { token?: string };
  const token = query.token;

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
    fastify.log.warn(
      { err },
      "WS connection rejected: invalid or expired token",
    );
    socket.close(1008, "Invalid token");
    return;
  }

  fastify.log.info(`User authenticated on WS: ${userId}`);
  connectedClients.set(userId, socket);

  // Deliver offline/pending messages upon connection
  (async () => {
    try {
      const pendingMessages = await fastify.prisma.directMessage.findMany({
        where: {
          receiverId: userId,
          delivered: false,
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (pendingMessages.length === 0) {
        return;
      }

      // Dispatch pending messages if socket is still active
      for (const msg of pendingMessages) {
        if (socket.readyState !== socket.OPEN) {
          return;
        }

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

      // Mark delivered in a single batch query
      await fastify.prisma.directMessage.updateMany({
        where: {
          id: { in: pendingMessages.map((m) => m.id) },
        },
        data: {
          delivered: true,
        },
      });

      fastify.log.info(
        { count: pendingMessages.length, userId },
        "Pending messages successfully delivered",
      );
    } catch (err) {
      fastify.log.error({ err }, "Failed to deliver pending messages");
    }
  })();

  // Handle incoming WebSocket messages
  socket.on("message", async (rawMessage: Buffer) => {
    let parsed: Record<string, unknown>;

    // 1. Safe JSON parsing
    try {
      parsed = JSON.parse(rawMessage.toString());
    } catch {
      socket.send(JSON.stringify({ error: "Invalid JSON format" }));
      return;
    }

    // 2. Validate payload structure
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

    const payload: SendDirectMessagePayload = {
      type,
      receiverId,
      content,
    };

    // 3. Prevent self-messaging
    if (payload.receiverId === userId) {
      socket.send(JSON.stringify({ error: "Cannot send message to yourself" }));
      return;
    }

    fastify.log.info(
      { from: userId, to: payload.receiverId },
      "Direct message validated",
    );

    // Check if recipient is connected and ready to receive
    const recipientSocket = connectedClients.get(payload.receiverId);
    const isRecipientOnline =
      recipientSocket !== undefined &&
      recipientSocket.readyState === socket.OPEN;

    // 4. Persist to database
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

    // 5. Build outbound frame
    const outboundString = JSON.stringify({
      type: "direct_message",
      id: savedMessage.id,
      senderId: savedMessage.senderId,
      receiverId: savedMessage.receiverId,
      content: savedMessage.content,
      createdAt: savedMessage.createdAt.toISOString(),
    });

    // 6. Push to recipient if online
    if (isRecipientOnline && recipientSocket) {
      recipientSocket.send(outboundString);
    }

    // 7. Acknowledge back to sender
    if (socket.readyState === socket.OPEN) {
      socket.send(outboundString);
    }
  });

  // Handle client disconnection
  socket.on("close", () => {
    // Only remove from map if it represents the current active connection
    if (connectedClients.get(userId) === socket) {
      connectedClients.delete(userId);
    }
    fastify.log.info(`User disconnected: ${userId}`);
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
