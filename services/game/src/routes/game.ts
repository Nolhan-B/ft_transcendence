import { FastifyInstance } from "fastify";
import { CreateGamePayload, CreateRoomPayload, JwtPayload } from "shared";

export default async function gameRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/games/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["participants", "mode"],
          properties: {
            participants: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string", minLength: 1 },
                },
              },
            },
            mode: { type: "string", minLength: 1 },
            settings: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      const { id } = request.user as JwtPayload;

      const { participants, mode, settings } =
        request.body as CreateGamePayload;

      // Ensure all participant IDs are distinct
      const uniqueIds = new Set(participants.map((p) => p.id));
      if (uniqueIds.size !== participants.length) {
        return reply
          .code(400)
          .send({ error: "Duplicate participants are not allowed" });
      }

      if (!uniqueIds.has(id)) {
        return reply.code(400).send({ error: "Creator must be a participant" });
      }

      const gameId = fastify.gameManager.createGame(
        participants,
        mode,
        settings,
      );
      return reply.code(201).send({ gameId });
    },
  );

  fastify.post(
    "/games/rooms",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "mode", "maxPlayers"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 50 },
            mode: { type: "string", minLength: 1 },
            maxPlayers: { type: "integer", minimum: 2, maximum: 4 },
            password: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      const { id } = request.user as JwtPayload;

      const user = await fastify.prisma.user.findUnique({
        where: { id },
        select: { username: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const { name, mode, maxPlayers, password } =
        request.body as CreateRoomPayload;

      if (name.trim().length === 0) {
        return reply.code(400).send({ error: "Room name cannot be empty" });
      }

      const roomCode = fastify.roomManager.createRoom(
        id,
        user.username,
        mode,
        maxPlayers,
        name.trim(),
        password,
      );

      return reply.code(201).send({ roomCode });
    },
  );

  fastify.get("/games/rooms", async () => {
    const rooms = fastify.roomManager.listRooms();
    return rooms.map((r) => ({
      code: r.code,
      name: r.name,
      hasPassword: !!r.password,
      leaderId: r.leaderId,
      maxPlayers: r.maxPlayers,
      players: r.players,
      mode: r.mode,
      settings: r.settings,
    }));
  });

  fastify.get("/games/history", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const matches = await fastify.prisma.match.findMany({
      where: { players: { has: id } },
      orderBy: { endedAt: "desc" },
      select: {
        id: true,
        mode: true,
        players: true,
        ranking: true,
        winnerId: true,
        startedAt: true,
        endedAt: true,
      },
    });

    return reply.send(matches);
  });
}
