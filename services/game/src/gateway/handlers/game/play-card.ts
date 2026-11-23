import { GatewayContext } from "../../types.js";
import { GameStatus } from "shared";
import {
  advanceToNextPlayer,
  drawAndRecord,
  recordAction,
} from "../../../engine/game-state.js";
import { continueTurn } from "./bot-turn.js";

// Delai pour accepter ou contester un +4 avant qu'il soit accepte d'office
const BLUFF_TIMEOUT_MS = Number(process.env.BLUFF_TIMEOUT_MS) || 5000;

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
      updatedState.lastWildDraw4.expiresAt = Date.now() + BLUFF_TIMEOUT_MS;
      ctx.bluffTimers.set(
        updatedState.id,
        setTimeout(() => {
          ctx.bluffTimers.delete(updatedState.id);
          // Pas de reponse a temps : le +4 est accepte d'office
          recordAction(updatedState, {
            type: "wild_draw4_accepted",
            userId: targetId,
            auto: true,
          });
          drawAndRecord(updatedState, targetId, 4, "wild_draw4", true);
          updatedState.lastWildDraw4 = undefined;
          advanceToNextPlayer(updatedState);
          // Sans ca, un bot suivant ne joue jamais et l'humain suivant
          // herite du reste du chrono de la victime
          continueTurn(ctx, updatedState);
          ctx.broadCastStateToRoom(updatedState.id, updatedState);
        }, BLUFF_TIMEOUT_MS),
      );
    }
  }

  ctx.afkCounts.set(`${game.id}:${ctx.userId}`, 0);

  // Effets d'abord (chrono, bot), envoi ensuite : l'etat diffuse contient
  // ainsi le chrono du joueur suivant. Ne fait rien si la partie est finie
  continueTurn(ctx, updatedState);
  ctx.broadCastStateToRoom(updatedState.id, updatedState);

  if (updatedState.status === GameStatus.FINISHED) {
    await ctx.endGame(updatedState.id, updatedState);
  }
}
