import { GatewayContext } from "../../types.js";
import { GameStatus } from "shared";
import { recordAction } from "../../../engine/game-state.js";

export function handleCallUno(
  ctx: GatewayContext,
  msg: { gameId: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || game.status !== GameStatus.IN_PROGRESS) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }

  const player = game.players.find((p) => p.userId === ctx.userId);
  if (!player || player.disconnected) {
    ctx.sendError(ctx.socket, "You are not part of this game");
    return;
  }

  // UNO ne compte que si le joueur est vraiment dans la fenêtre pour le dire
  if (!ctx.unoTimers.has(ctx.userId)) {
    ctx.sendError(ctx.socket, "Nothing to call");
    return;
  }

  clearTimeout(ctx.unoTimers.get(ctx.userId));
  ctx.unoTimers.delete(ctx.userId);

  recordAction(game, { type: "uno_called", userId: ctx.userId });
  ctx.broadCastToRoom(msg.gameId, { type: "uno_called", userId: ctx.userId });
  ctx.broadCastStateToRoom(game.id, game);
}
