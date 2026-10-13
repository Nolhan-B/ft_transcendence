import { PrismaClient } from "../../../../shared/src/generated/prisma/client.js";
import { GameManager } from "../managers/game.manager.js";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    gameManager: GameManager;
  }
}
