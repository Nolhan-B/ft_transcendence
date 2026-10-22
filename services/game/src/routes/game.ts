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

    if (participants.length < 2 || participants.length > 4) {
      return reply.code(400).send({ error: "Game requires 2 to 4 players" });
    }

    const gameId = fastify.gameManager.createGame(participants, mode, settings);
    return reply.code(201).send({ gameId });
  });
}
