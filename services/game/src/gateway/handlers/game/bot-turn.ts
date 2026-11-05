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
    () => {
      const botPlayer = gameState.players.find(
        (p) => p.isCurrentTurn === true,
      )!;

      // Copie du ctx pour le bot : le ctx de l'humain n'est jamais modif
      const botCtx: GatewayContext = { ...ctx, userId: botPlayer.userId };

      if (gameState.lastWildDraw4) {
        if (shouldChallengeBluff(botPlayer.hand, gameState.currentColor)) {
          handleChallengeBluff(botCtx, { gameId: gameId });
          return;
        }
        handleAcceptWildDraw4(botCtx, { gameId: gameId });
        return;
      }

      const cardToPlay = chooseCard(
        botPlayer.hand,
        gameState.topCard,
        gameState.currentColor,
        gameState.pendingDrawCount,
        gameState.settings.stacking,
      );

      if (!cardToPlay) {
        handleDrawCard(botCtx, { gameId: gameId });
        return;
      }

      switch (cardToPlay.value) {
        case "7": {
          handlePlayCard(botCtx, {
            gameId: gameId,
            cardId: cardToPlay.id,
            targetUserId: chooseSwapTarget(
              gameState.players.map((p) => {
                return { userId: p.userId, handCount: p.hand.length };
              }),
              botPlayer.userId,
            ),
          });
          break;
        }
        case "wild":
        case "wild_draw4": {
          handlePlayCard(botCtx, {
            gameId: gameId,
            cardId: cardToPlay.id,
            chosenColor: chooseColor(botPlayer.hand),
          });
          break;
        }
        default: {
          handlePlayCard(botCtx, { gameId: gameId, cardId: cardToPlay.id });
          break;
        }
      }
    },
    500 + Math.random() * 1000,
  );
}
