import { GatewayContext } from "../../types.js";
import type { ServerEvent } from "shared";
import {
  advanceToNextPlayer,
  drawCardsForPlayer,
} from "../../../engine/game-state.js";

export async function handleChallengeBluff(
  ctx: GatewayContext,
  msg: { gameId: string },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || !game.lastWildDraw4) {
    ctx.sendError(ctx.socket, "No bluff to challenge");
    return;
  }

  if (ctx.bluffTimers.has(game.id)) {
    clearTimeout(ctx.bluffTimers.get(game.id));
    ctx.bluffTimers.delete(game.id);
  }

  const { playerId: blufferId, hadMatchingColor } = game.lastWildDraw4;

  if (hadMatchingColor) {
    drawCardsForPlayer(game, blufferId, 4);
  } else {
    drawCardsForPlayer(game, ctx.userId, 6);
    advanceToNextPlayer(game);
  }

  ctx.broadCastToRoom(game.id, {
    type: "bluff_result",
    challengerUserId: ctx.userId,
    targetUserId: blufferId,
    wasBluff: hadMatchingColor,
    penaltyCount: hadMatchingColor ? 4 : 6,
  } as ServerEvent);

  game.lastWildDraw4 = undefined;
  ctx.broadCastStateToRoom(game.id, game);
}
