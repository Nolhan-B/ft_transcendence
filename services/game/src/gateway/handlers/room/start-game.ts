import { GatewayContext } from "../../types.js";
import type { ServerEvent } from "shared";
import { isPlayingAGame } from "./lobby-rules.js";

export function handleStartGame(
  ctx: GatewayContext,
  msg: { roomCode: string },
): void {
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) {
    ctx.sendError(ctx.socket, "Room not found");
    return;
  }
  if (room.leaderId !== ctx.userId) {
    ctx.sendError(ctx.socket, "Only the leader can start");
    return;
  }
  if (room.players.length < 2) {
    ctx.sendError(ctx.socket, "Need at least 2 players");
    return;
  }
  // Personne ne joue deux parties en meme temps
  const busy = room.players.find((p) => isPlayingAGame(ctx, p.id));
  if (busy) {
    ctx.sendError(ctx.socket, `${busy.username} is already in a game`);
    return;
  }
  const participants = room.players.map((p) => ({
    id: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl ?? null,
  }));
  const gameId = ctx.fastify.gameManager.createGame(
    participants,
    room.mode,
    room.settings,
  );
  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "game_started",
    gameId,
  } as ServerEvent);
  if (gameId) ctx.cancelGameIfNeverJoined(gameId);
  ctx.roomSockets.delete(msg.roomCode);
  ctx.roomManager.removeRoom(msg.roomCode);
}
