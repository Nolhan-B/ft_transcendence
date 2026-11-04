import { GatewayContext } from "../../types.js";
import {
  advanceToNextPlayer,
  drawCardsForPlayer,
} from "../../../engine/game-state.js";

export function handleAcceptWildDraw4(
  ctx: GatewayContext,
  msg: { gameId: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || !game.lastWildDraw4) {
    ctx.sendError(ctx.socket, "Nothing to accept");
    return;
  }

  if (ctx.bluffTimers.has(game.id)) {
    clearTimeout(ctx.bluffTimers.get(game.id));
    ctx.bluffTimers.delete(game.id);
  }

  drawCardsForPlayer(game, ctx.userId, 4);
  game.lastWildDraw4 = undefined;
  advanceToNextPlayer(game);
  ctx.broadCastStateToRoom(game.id, game);
}
