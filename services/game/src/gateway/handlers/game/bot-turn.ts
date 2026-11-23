import { GameStatus } from "shared";
import { InternalGameState } from "../../../engine/game-state.js";
import { GatewayContext } from "../../types.js";
import {
  chooseCard,
  chooseColor,
  chooseSwapTarget,
  shouldCallUno,
  shouldChallengeBluff,
} from "../../../engine/ai.js";
import { handleChallengeBluff } from "./challenge-bluff.js";
import { handleDrawCard } from "./draw-card.js";
import { handleAcceptWildDraw4 } from "./accept-wild-draw4.js";
import { handlePlayCard } from "./play-card.js";
import { handleCallUno } from "./call-uno.js";

// A appeler apres tout changement de tour declenche par le serveur (timer AFK,
// timer de bluff, deconnexion) : fait jouer le bot, ou lance le chrono de l'humain
export function continueTurn(
  ctx: GatewayContext,
  game: InternalGameState,
): void {
  if (game.status !== GameStatus.IN_PROGRESS) return;
  const next = game.players.find((p) => p.isCurrentTurn);
  if (!next) return;
  if (next.userId.startsWith("bot_")) {
    scheduleBotTurnIfNeeded(ctx, game, game.id);
  } else {
    ctx.startTurnTimer(game.id);
  }
}

export function scheduleBotTurnIfNeeded(
  ctx: GatewayContext,
  gameState: InternalGameState,
  gameId: string,
): void {
  const currentPlayer = gameState.players.find((p) => p.isCurrentTurn);
  if (!currentPlayer || !currentPlayer.userId.startsWith("bot_")) return;
  if (gameState.status === GameStatus.FINISHED) return;

  // On retient QUEL bot doit jouer : au declenchement, on verifiera que c'est toujours lui
  const botId = currentPlayer.userId;

  const playBotTurn = async () => {
    // On relit l'etat a jour : il a pu changer pendant le delai de reflexion
    const game = ctx.manager.getGame(gameId);
    if (!game || game.status !== GameStatus.IN_PROGRESS) return;

    const botPlayer = game.players.find((p) => p.isCurrentTurn);
    if (!botPlayer || botPlayer.userId !== botId) return;

    // Les erreurs du bot ne partent pas chez l'humain : on note juste l'echec
    let failed = false;
    const botCtx: GatewayContext = {
      ...ctx,
      userId: botId,
      sendError: () => {
        failed = true;
      },
    };

    if (game.lastWildDraw4) {
      if (shouldChallengeBluff(botPlayer.hand, game.currentColor)) {
        await handleChallengeBluff(botCtx, { gameId });
      } else {
        handleAcceptWildDraw4(botCtx, { gameId });
      }
      return;
    }

    const cardToPlay = chooseCard(
      botPlayer.hand,
      game.topCard,
      game.currentColor,
      game.pendingDrawCount,
      game.settings.stacking,
    );

    if (cardToPlay) {
      switch (cardToPlay.value) {
        case "7":
          await handlePlayCard(botCtx, {
            gameId,
            cardId: cardToPlay.id,
            targetUserId: chooseSwapTarget(
              game.players
                .filter((p) => !p.disconnected)
                .map((p) => ({ userId: p.userId, handCount: p.hand.length })),
              botId,
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

      if (!failed) {
        // Plus qu'une carte : le bot dit UNO (ou l'oublie, une fois sur dix)
        const after = ctx.manager.getGame(gameId);
        const me = after?.players.find((p) => p.userId === botId);
        if (
          after?.status === GameStatus.IN_PROGRESS &&
          after.settings.unoCallout &&
          me &&
          shouldCallUno(me.hand)
        ) {
          handleCallUno(botCtx, { gameId });
        }
        return;
      }
      // Coup refuse : on pioche a la place
      failed = false;
    }

    await handleDrawCard(botCtx, { gameId });
    if (failed) {
      console.error(`[bot-turn] ${botId} bloqué dans la partie ${gameId}`);
    }
  };

  // Lance hors d'un handler : une erreur non rattrapee ici tuerait le processus
  setTimeout(
    () => {
      playBotTurn().catch((err) => {
        ctx.fastify.log.error({ err, botId, gameId }, "Bot turn failed");
      });
    },
    500 + Math.random() * 1000,
  );
}
