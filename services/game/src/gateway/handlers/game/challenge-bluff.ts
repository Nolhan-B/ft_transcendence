import { GatewayContext } from "../../types.js";
import type { ServerEvent } from "shared";
import {
  advanceToNextPlayer,
  drawAndRecord,
  recordAction,
} from "../../../engine/game-state.js";
import { continueTurn } from "./bot-turn.js";

export async function handleChallengeBluff(
  ctx: GatewayContext,
  msg: { gameId: string },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || !game.lastWildDraw4) {
    ctx.sendError(ctx.socket, "No bluff to challenge");
    return;
  }

  const target = game.players.find((p) => p.isCurrentTurn);
  if (!target || target.userId !== ctx.userId) {
    ctx.sendError(
      ctx.socket,
      "Only the targeted player can respond to this card",
    );
    return;
  }

  if (ctx.bluffTimers.has(game.id)) {
    clearTimeout(ctx.bluffTimers.get(game.id));
    ctx.bluffTimers.delete(game.id);
  }

  const { playerId: blufferId, hadMatchingColor } = game.lastWildDraw4;

  recordAction(game, {
    type: "bluff_challenged",
    userId: ctx.userId,
    targetUserId: blufferId,
    wasBluff: hadMatchingColor,
  });
  if (hadMatchingColor) {
    drawAndRecord(game, blufferId, 4, "bluff_penalty");
  } else {
    drawAndRecord(game, ctx.userId, 6, "bluff_penalty");
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
  continueTurn(ctx, game);
  ctx.broadCastStateToRoom(game.id, game);
}
