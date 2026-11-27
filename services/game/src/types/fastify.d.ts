import { PrismaClient } from "shared";
import { GameManager } from "../managers/game.manager.js";
import "@fastify/jwt";
import { RoomManager } from "../managers/room.manager.ts";
import { QueueManager } from "../managers/queue.manager.ts";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    gameManager: GameManager;
    roomManager: RoomManager;
    queueManager: QueueManager;
  }
}
