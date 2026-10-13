import { FastifyInstance } from "fastify";
import { CreateGamePayload, JwtPayload } from "shared";

export default async function gameRoutes(fastify: FastifyInstance) {
  fastify.post("/games/create", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const { participants, mode, settings } = request.body as CreateGamePayload;

    const isCreatorInGame = participants.some((p) => p.id === id);
    if (!isCreatorInGame)
      return reply.code(400).send({ error: "Creator must be a participant" });

    const gameId = fastify.gameManager.createGame(participants, mode, settings);
    return reply.code(201).send({ gameId });
  });
}
