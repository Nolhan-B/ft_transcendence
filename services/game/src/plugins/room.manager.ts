import fp from "fastify-plugin";
import { RoomManager } from "../managers/room.manager.js";

export default fp(async (fastify) => {
  const manager = new RoomManager();
  fastify.decorate("roomManager", manager);
});
