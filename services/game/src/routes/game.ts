import { FastifyInstance } from "fastify";
import {
  CreateGamePayload,
  CreateRoomPayload,
  GameMode,
  JwtPayload,
} from "shared";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_NAME_MAX_LENGTH,
  isValidSettings,
  pickSettings,
} from "../gateway/utils.js";

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
            mode: { type: "string", enum: Object.values(GameMode) },
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
      if (mode === GameMode.RANKED) {
        return reply.code(400).send({
          error: "Ranked games are only available through matchmaking",
        });
      }

      const isCreatorInGame = participants.some((p) => p.id === id);
      if (!isCreatorInGame)
        return reply.code(400).send({ error: "Creator must be a participant" });

      if (!uniqueIds.has(id)) {
        return reply.code(400).send({ error: "Creator must be a participant" });
      }

      if (settings !== undefined && !isValidSettings(settings)) {
        return reply.code(400).send({ error: "Invalid game settings" });
      }

      const gameId = fastify.gameManager.createGame(
        participants,
        mode,
        settings && pickSettings(settings),
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
            name: {
              type: "string",
              minLength: 1,
              maxLength: ROOM_NAME_MAX_LENGTH,
            },
            mode: { type: "string", enum: Object.values(GameMode) },
            maxPlayers: {
              type: "integer",
              minimum: MIN_PLAYERS,
              maximum: MAX_PLAYERS,
            },
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
      if (mode === GameMode.RANKED) {
        return reply.code(400).send({
          error: "Ranked games are only available through matchmaking",
        });
      }

      if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
        return reply.code(400).send({
          error: `Max players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`,
        });
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

  // Lobby: connected users only (security audit F-20)
  fastify.get("/games/rooms", async (request) => {
    await request.jwtVerify();
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

  // Parties en cours que l'on peut regarder en spectateur. Aucune carte : juste
  // les joueurs, leur nombre de cartes et a qui c'est le tour
  fastify.get("/games/live", async (request) => {
    await request.jwtVerify();
    return fastify.gameManager.listLiveGames().map((game) => ({
      id: game.id,
      mode: game.mode,
      players: game.players.map((player) => ({
        userId: player.userId,
        username: player.username,
        cardCount: player.hand.length,
        isCurrentTurn: player.isCurrentTurn,
      })),
    }));
  });

  const findHistory = (userId: string) =>
    fastify.prisma.match.findMany({
      where: { players: { has: userId } },
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

  // Historique du joueur connecte
  fastify.get("/games/history", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    return reply.send(await findHistory(id));
  });

  // Historique d'un autre joueur (page profil d'un ami, etc.). Il faut etre
  // connecte, mais les parties ne sont pas privees : c'est le meme niveau
  // d'info que le classement
  fastify.get<{ Params: { userId: string } }>(
    "/games/history/:userId",
    {
      schema: {
        params: {
          type: "object",
          required: ["userId"],
          properties: { userId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      return reply.send(await findHistory(request.params.userId));
    },
  );
}
