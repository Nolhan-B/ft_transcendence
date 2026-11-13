import fp from "fastify-plugin";
import { QueueManager } from "../managers/queue.manager.js";

export default fp(async (fastify) => {
  const manager = new QueueManager();
  fastify.decorate("queueManager", manager);
});
