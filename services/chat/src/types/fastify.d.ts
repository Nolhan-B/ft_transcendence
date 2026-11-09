import type { PrismaClient } from "shared";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
