import { GatewayContext } from "../../types.js";
import {
  advanceToNextPlayer,
  drawAndRecord,
  recordAction,
} from "../../../engine/game-state.js";
import { continueTurn } from "./bot-turn.js";

export function handleAcceptWildDraw4(
  ctx: GatewayContext,
  msg: { gameId: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || !game.lastWildDraw4) {
    ctx.sendError(ctx.socket, "Nothing to accept");
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

  recordAction(game, { type: "wild_draw4_accepted", userId: ctx.userId });
  drawAndRecord(game, ctx.userId, 4, "wild_draw4");
  game.lastWildDraw4 = undefined;
  advanceToNextPlayer(game);
  ctx.broadCastStateToRoom(game.id, game);

  continueTurn(ctx, game);
}
