import { PrismaClient } from "../../../../shared/src/generated/prisma/client.js";
import { GameManager } from "../managers/game.manager.js";
import "@fastify/jwt";
import { RoomManager } from "../managers/room.manager.ts";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    gameManager: GameManager;
    roomManager: RoomManager;
  }
}
