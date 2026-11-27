import fp from "fastify-plugin";
import { GameManager } from "../managers/game.manager.js";

export default fp(async (fastify) => {
  const manager = new GameManager();
  fastify.decorate("gameManager", manager);
});
