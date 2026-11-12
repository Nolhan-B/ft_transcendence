import Fastify from "fastify";
import gameGateway from "./gateway/game.gateway.js";
import websocket from "@fastify/websocket";
import gameRoutes from "./routes/game.js";
import gameManager from "./plugins/game.manager.js";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import prismaPlugin from "./plugins/prisma.js";
import roomManager from "./plugins/room.manager.js";
import { setupMetrics } from "shared";
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

setupMetrics(fastify, "game-service");

fastify.route({
  method: ["GET", "HEAD"],
  url: "/health",
  logLevel: "silent",
  handler: async () => ({ service: "game", status: "ok" }),
});

fastify.register(cookie);
fastify.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret",
  cookie: {
    cookieName: "access_token",
    signed: false,
  },
});

fastify.register(prismaPlugin);
fastify.register(websocket);
fastify.register(gameManager);
fastify.register(roomManager);
fastify.register(queueManager);

fastify.register(gameGateway);
fastify.register(gameRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
