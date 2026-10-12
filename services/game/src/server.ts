import Fastify from "fastify";
import gameGateway from "./gateway/game.gateway.js";
import websocket from "@fastify/websocket";
import gameRoutes from "./routes/game.js";
import gameManager from "./plugins/game.manager.js";
import jwt from "@fastify/jwt";

const fastify = Fastify({
  logger: true,
});

fastify.get(
  "/health",
  {
    logLevel: "silent",
  },
  async () => ({ service: "game", status: "ok" }),
);

fastify.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret" });

fastify.register(websocket);
fastify.register(gameManager);

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
