import { FastifyInstance } from "fastify";
import type { JwtPayload } from "shared";
import {
  getTopPlayers,
  getPlayerRank,
} from "../services/leaderboard.service.js";

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get("/leaderboard", async (request, reply) => {
    await request.jwtVerify();
    const { limit } = request.query as { limit?: string };
    // 10 par défaut, entre 1 et 100
    const take = Math.min(Math.max(Math.floor(Number(limit)) || 10, 1), 100);
    const leaderboard = await getTopPlayers(fastify.prisma, take);
    return reply.send({ leaderboard });
  });

  fastify.get("/leaderboard/me", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const entry = await getPlayerRank(fastify.prisma, id);
    if (!entry) return reply.code(404).send({ error: "User not found" });

    return reply.send(entry);
  });
}
