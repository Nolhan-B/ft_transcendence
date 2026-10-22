import { FastifyInstance } from "fastify";
import { CreateGamePayload, CreateRoomPayload, JwtPayload } from "shared";

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

  fastify.post("/games/rooms", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const user = await fastify.prisma.user.findUnique({
      where: { id },
      select: { username: true },
    });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const { name, mode, maxPlayers, password } =
      request.body as CreateRoomPayload;

    if (maxPlayers < 2 || maxPlayers > 4) {
      return reply
        .code(400)
        .send({ error: "Max players must be between 2 and 4" });
    }

    const roomCode = fastify.roomManager.createRoom(
      id,
      user.username,
      mode,
      maxPlayers,
      name,
      password,
    );

    return reply.code(201).send({ roomCode });
  });
}
