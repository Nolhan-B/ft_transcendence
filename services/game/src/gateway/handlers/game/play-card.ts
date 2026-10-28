import { GatewayContext } from "../../types.js";
import { GameStatus } from "shared";
import {
  advanceToNextPlayer,
  drawCardsForPlayer,
} from "../../../engine/game-state.js";

export async function handlePlayCard(
  ctx: GatewayContext,
  msg: {
    gameId: string;
    cardId: string;
    chosenColor?: string;
    targetUserId?: string;
  },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (game === undefined) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }
  const updatedState = ctx.manager.playCard(
    game.id,
    ctx.userId,
    msg.cardId,
    msg.chosenColor,
    msg.targetUserId,
  );
  if (!updatedState) {
    ctx.sendError(ctx.socket, "Invalid move");
    return;
  }

  if (!ctx.moveLogs.has(updatedState.id)) ctx.moveLogs.set(updatedState.id, []);

  ctx.moveLogs.get(updatedState.id)!.push({
    userId: ctx.userId,
    action: "play_card",
    cardId: msg.cardId,
    cardColor: updatedState.topCard.color,
    cardValue: updatedState.topCard.value,
    chosenColor: msg.chosenColor,
    time: new Date().toISOString(),
  });

  ctx.broadCastStateToRoom(updatedState.id, updatedState);

  if (updatedState.settings.unoCallout) {
    const playerHand = updatedState.players.find(
      (p) => p.userId === ctx.userId,
    )?.hand;
    if (playerHand && playerHand.length === 1) {
      ctx.unoTimers.set(
        ctx.userId,
        setTimeout(() => {
          ctx.unoTimers.delete(ctx.userId);
        }, 5000),
      );
    }
  }

  if (updatedState.lastWildDraw4 && updatedState.settings.bluffChallenge) {
    const targetId = updatedState.players.find((p) => p.isCurrentTurn)?.userId;
    if (targetId) {
      ctx.bluffTimers.set(
        updatedState.id,
        setTimeout(() => {
          ctx.bluffTimers.delete(updatedState.id);
          drawCardsForPlayer(updatedState, targetId, 4);
          updatedState.lastWildDraw4 = undefined;
          advanceToNextPlayer(updatedState);
          ctx.broadCastStateToRoom(updatedState.id, updatedState);
        }, 5000),
      );
    }
  }

  ctx.afkCounts.set(`${game.id}:${ctx.userId}`, 0);

  if (updatedState.status === GameStatus.FINISHED) {
    await ctx.endGame(updatedState.id, updatedState);
    return;
  }

  ctx.startTurnTimer(game.id);
}
