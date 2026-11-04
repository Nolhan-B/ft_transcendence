import { GatewayContext } from "../../types.js";
import type { ServerEvent } from "shared";

export function handleCatchUno(
  ctx: GatewayContext,
  msg: { gameId: string; targetUserId: string },
): void {
  const target = msg.targetUserId;
  if (!ctx.unoTimers.has(target)) {
    ctx.sendError(ctx.socket, "Player already called UNO or not in UNO state");
    return;
  }
  clearTimeout(ctx.unoTimers.get(target));
  ctx.unoTimers.delete(target);

  const game = ctx.manager.getGame(msg.gameId);
  if (!game) return;

  const targetPlayer = game.players.find((p) => p.userId === target);
  if (targetPlayer) {
    for (let i = 0; i < 2; i++) {
      if (game.drawPile.length === 0) break;
      const card = game.drawPile.shift();
      if (card) targetPlayer.hand.push(card);
    }
    game.drawPileCount = game.drawPile.length;
  }

  ctx.broadCastToRoom(msg.gameId, {
    type: "uno_caught",
    targetUserId: target,
    catcherUserId: ctx.userId,
  } as ServerEvent);
  ctx.broadCastStateToRoom(game.id, game);
}
