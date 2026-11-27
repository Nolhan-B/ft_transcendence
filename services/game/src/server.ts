import Fastify, { FastifyError } from "fastify";
import gameGateway from "./gateway/game.gateway.js";
import websocket from "@fastify/websocket";
import gameRoutes from "./routes/game.js";
import gameManager from "./plugins/game.manager.js";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import prismaPlugin from "./plugins/prisma.js";
import roomManager from "./plugins/room.manager.js";
import {
  isSessionCurrent,
  jwtSecretOrExit,
  setupMetrics,
  setupOriginCheck,
} from "shared";
import type { SessionPayload } from "shared";
import fs from "node:fs";
import process from "node:process";
import queueManager from "./plugins/queue.manager.js";

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
    if (error.code === "P2034") {
      return reply
        .code(409)
        .send({ error: "Concurrent modification conflict, please retry" });
    }

    // Preserve standard 4xx client errors (Ajv validation, JWT auth, malformed JSON)
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

setupMetrics(fastify, "game-service");
// Writes sent from another website are refused (security audit F-25)
setupOriginCheck(fastify);

fastify.route({
  method: ["GET", "HEAD"],
  url: "/health",
  logLevel: "silent",
  handler: async () => ({ service: "game", status: "ok" }),
});

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

fastify.register(prismaPlugin);
// Trames bornees : les messages du jeu font quelques centaines d'octets
// (audit F-22)
fastify.register(websocket, { options: { maxPayload: 16 * 1024 } });

// Derniere ligne de defense : une erreur oubliee est journalisee au lieu
// d'arreter le service et toutes les parties en cours (audit F-01)
process.on("unhandledRejection", (reason) => {
  fastify.log.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  fastify.log.error({ err }, "Uncaught exception");
});
fastify.register(gameManager);
fastify.register(roomManager);
fastify.register(queueManager);

fastify.register(gameGateway);
fastify.register(gameRoutes);

const start = async () => {
  try {
    const port = Number(process.env.GAME_PORT ?? 3002);
    await fastify.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
