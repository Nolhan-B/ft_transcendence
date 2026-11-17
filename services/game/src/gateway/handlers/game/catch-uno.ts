import { GatewayContext } from "../../types.js";
import { GameStatus, type ServerEvent } from "shared";
import { drawCardsForPlayer } from "../../../engine/game-state.js";

export function handleCatchUno(
  ctx: GatewayContext,
  msg: { gameId: string; targetUserId: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || game.status !== GameStatus.IN_PROGRESS) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }

  // L'appelant doit etre un joueur actif de cette partie
  const catcher = game.players.find((p) => p.userId === ctx.userId);
  if (!catcher || catcher.disconnected) {
    ctx.sendError(ctx.socket, "You are not part of this game");
    return;
  }

  if (msg.targetUserId === ctx.userId) {
    ctx.sendError(ctx.socket, "You cannot catch yourself");
    return;
  }

  // La cible doit etre dans cette partie
  const targetPlayer = game.players.find((p) => p.userId === msg.targetUserId);
  if (!targetPlayer) {
    ctx.sendError(ctx.socket, "Target is not part of this game");
    return;
  }

  if (!ctx.unoTimers.has(msg.targetUserId)) {
    ctx.sendError(ctx.socket, "Player already called UNO or not in UNO state");
    return;
  }

  // Tout est verifie : on applique la penalite
  clearTimeout(ctx.unoTimers.get(msg.targetUserId));
  ctx.unoTimers.delete(msg.targetUserId);

  drawCardsForPlayer(game, msg.targetUserId, 2);

  ctx.broadCastToRoom(msg.gameId, {
    type: "uno_caught",
    targetUserId: msg.targetUserId,
    catcherUserId: ctx.userId,
  } as ServerEvent);
  ctx.broadCastStateToRoom(game.id, game);
}
