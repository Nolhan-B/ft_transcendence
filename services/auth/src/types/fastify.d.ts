import { PrismaClient } from "shared";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
