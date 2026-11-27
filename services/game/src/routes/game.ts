import { FastifyInstance } from "fastify";
import { CreateRoomPayload, GameMode, JwtPayload } from "shared";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_NAME_MAX_LENGTH,
} from "../gateway/utils.js";
import { computeAchievements, humanIds, toMatch } from "../engine/stats.js";

export default async function gameRoutes(fastify: FastifyInstance) {
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
        select: { username: true, avatarUrl: true },
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
        user.avatarUrl,
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
        avatarUrl: player.avatarUrl ?? null,
        cardCount: player.hand.length,
        isCurrentTurn: player.isCurrentTurn,
      })),
    }));
  });

  // Parties terminees d'un joueur, les plus recentes d'abord, avec le pseudo
  // et l'avatar actuels de chaque joueur
  async function findHistory(userId: string) {
    const rows = await fastify.prisma.match.findMany({
      where: { players: { has: userId } },
      orderBy: { endedAt: "desc" },
      select: {
        id: true,
        mode: true,
        players: true,
        playerNames: true,
        ranking: true,
        winnerId: true,
        eloChanges: true,
        startedAt: true,
        endedAt: true,
      },
    });
    const users = await fastify.prisma.user.findMany({
      where: { id: { in: humanIds(rows) } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((row) => toMatch(row, byId));
  }

  const userIdParams = {
    params: {
      type: "object",
      required: ["userId"],
      properties: { userId: { type: "string", minLength: 1, maxLength: 64 } },
    },
  };

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
    { schema: userIdParams },
    async (request, reply) => {
      await request.jwtVerify();
      return reply.send(await findHistory(request.params.userId));
    },
  );

  // Succes d'un joueur, calcules a partir de son historique et de son ELO
  fastify.get<{ Params: { userId: string } }>(
    "/games/achievements/:userId",
    { schema: userIdParams },
    async (request, reply) => {
      await request.jwtVerify();
      const { userId } = request.params;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      const history = await findHistory(userId);
      return reply.send({
        achievements: computeAchievements(history, userId, user.elo),
      });
    },
  );
}
