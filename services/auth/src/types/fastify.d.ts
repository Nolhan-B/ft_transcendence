import { PrismaClient } from "../../../../shared/src/generated/prisma/client.js";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
