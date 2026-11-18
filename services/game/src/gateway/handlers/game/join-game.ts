import { GatewayContext } from "../../types.js";
import { filterStateForPlayer } from "../../utils.js";

export async function handleJoinGame(
  ctx: GatewayContext,
  msg: { gameId: string },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (game === undefined) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }
  const isPlayer = game.players.some((p) => p.userId === ctx.userId);
  if (!isPlayer) {
    ctx.sendError(ctx.socket, "You are not part of this game");
    return;
  }
  const key = `${msg.gameId}:${ctx.userId}`;
  const pending = ctx.disconnectTimers.get(key);
  if (pending) {
    clearTimeout(pending);
    ctx.disconnectTimers.delete(key);
  }

  if (!ctx.rooms.has(msg.gameId)) {
    ctx.rooms.set(msg.gameId, new Set());
  }
  ctx.rooms.get(msg.gameId)!.add({ socket: ctx.socket, userId: ctx.userId });

  ctx.broadCastToRoom(
    msg.gameId,
    { type: "player_joined", userId: ctx.userId },
    ctx.userId,
  );

  const playerGameState = filterStateForPlayer(game, ctx.userId);
  ctx.socket.send(
    JSON.stringify({ type: "game_updated", state: playerGameState }),
  );

  const current = game.players.find((p) => p.isCurrentTurn);
  if (
    !ctx.turnTimers.has(msg.gameId) &&
    current &&
    !current.userId.startsWith("bot_")
  ) {
    ctx.startTurnTimer(msg.gameId);
  }
}
