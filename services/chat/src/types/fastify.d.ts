import type { PrismaClient } from "../../../../shared/src/generated/prisma/client.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
