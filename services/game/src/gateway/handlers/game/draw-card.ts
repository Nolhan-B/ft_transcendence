import { GatewayContext } from "../../types.js";
import { GameStatus } from "shared";

export async function handleDrawCard(
  ctx: GatewayContext,
  msg: { gameId: string },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }
  const updatedState = ctx.manager.drawCard(game.id, ctx.userId);
  if (!updatedState) {
    ctx.sendError(ctx.socket, "Cannot draw card");
    return;
  }

  if (!ctx.moveLogs.has(updatedState.id)) ctx.moveLogs.set(updatedState.id, []);

  const currentPlayer = updatedState.players.find(
    (p) => p.userId === ctx.userId,
  );
  const drawnCard = currentPlayer?.hand[currentPlayer.hand.length - 1];

  ctx.moveLogs.get(updatedState.id)!.push({
    userId: ctx.userId,
    action: "draw_card",
    cardId: drawnCard?.id,
    cardColor: drawnCard?.color,
    cardValue: drawnCard?.value,
    time: new Date().toISOString(),
  });

  ctx.broadCastStateToRoom(updatedState.id, updatedState);

  ctx.afkCounts.set(`${game.id}:${ctx.userId}`, 0);
  ctx.startTurnTimer(game.id);

  if (updatedState.status === GameStatus.FINISHED) {
    await ctx.endGame(updatedState.id, updatedState);
    return;
  }
}
