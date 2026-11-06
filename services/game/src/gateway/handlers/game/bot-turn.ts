import { GameStatus } from "shared";
import { InternalGameState } from "../../../engine/game-state.js";
import { GatewayContext } from "../../types.js";
import {
  chooseCard,
  chooseColor,
  chooseSwapTarget,
  shouldChallengeBluff,
} from "../../../engine/ai.js";
import { handleChallengeBluff } from "./challenge-bluff.js";
import { handleDrawCard } from "./draw-card.js";
import { handleAcceptWildDraw4 } from "./accept-wild-draw4.js";
import { handlePlayCard } from "./play-card.js";

export function scheduleBotTurnIfNeeded(
  ctx: GatewayContext,
  gameState: InternalGameState,
  gameId: string,
): void {
  const currentPlayer = gameState.players.find((p) => p.isCurrentTurn);
  if (!currentPlayer || !currentPlayer.userId.startsWith("bot_")) return;

  if (gameState.status === GameStatus.FINISHED) return;

  setTimeout(
    async () => {
      const botPlayer = gameState.players.find(
        (p) => p.isCurrentTurn === true,
      )!;

      // Les erreurs du bot ne partent pas chez l'humain : on note juste l'échec
      let failed = false;
      const botCtx: GatewayContext = {
        ...ctx,
        userId: botPlayer.userId,
        sendError: () => {
          failed = true;
        },
      };

      if (gameState.lastWildDraw4) {
        if (shouldChallengeBluff(botPlayer.hand, gameState.currentColor)) {
          await handleChallengeBluff(botCtx, { gameId });
        } else {
          handleAcceptWildDraw4(botCtx, { gameId });
        }
        return;
      }

      const cardToPlay = chooseCard(
        botPlayer.hand,
        gameState.topCard,
        gameState.currentColor,
        gameState.pendingDrawCount,
        gameState.settings.stacking,
      );

      if (cardToPlay) {
        switch (cardToPlay.value) {
          case "7":
            await handlePlayCard(botCtx, {
              gameId,
              cardId: cardToPlay.id,
              targetUserId: chooseSwapTarget(
                gameState.players.map((p) => ({
                  userId: p.userId,
                  handCount: p.hand.length,
                })),
                botPlayer.userId,
              ),
            });
            break;
          case "wild":
          case "wild_draw4":
            await handlePlayCard(botCtx, {
              gameId,
              cardId: cardToPlay.id,
              chosenColor: chooseColor(botPlayer.hand),
            });
            break;
          default:
            await handlePlayCard(botCtx, { gameId, cardId: cardToPlay.id });
            break;
        }
        if (!failed) return;
        // Coup refusé : on pioche à la place
        failed = false;
      }

      await handleDrawCard(botCtx, { gameId });
      if (failed) {
        console.error(
          `[bot-turn] ${botPlayer.userId} bloqué dans la partie ${gameId}`,
        );
      }
    },
    500 + Math.random() * 1000,
  );
}
