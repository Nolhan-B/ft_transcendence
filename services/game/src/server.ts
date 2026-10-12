import Fastify from "fastify";
import gameGateway from "./gateway/game.gateway.js";
import websocket from "@fastify/websocket";

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

fastify.register(websocket);
fastify.register(gameGateway);

fastify.get("/", async () => {
  return { service: "game", status: "ok" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
