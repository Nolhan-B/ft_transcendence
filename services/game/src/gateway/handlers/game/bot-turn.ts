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
import { handleCatchUno } from "./catch-uno.js";
import { unoKey } from "../../utils.js";

// Delai de reflexion du bot : entre 2,5 s et 4,5 s par defaut, pour que les
// humains voient passer les coups. Reglable par l'environnement (les tests le
// raccourcissent). Lu a chaque coup, pas au chargement du module. Doit rester
// sous BLUFF_TIMEOUT_MS, sinon le bot n'a jamais le temps de contester un +4
function botDelayMs(): number {
  const min = Number(process.env.BOT_MIN_DELAY_MS) || 2500;
  const extra = Number(process.env.BOT_EXTRA_DELAY_MS) || 2000;
  return min + Math.random() * extra;
}

// A appeler apres tout changement de tour (coup d'un joueur, timer AFK, timer
// de bluff, deconnexion) : fait jouer le bot si c'est son tour, et relance
// toujours un chrono neuf. Sans ca, le chrono du joueur precedent continuait :
// un humain qui jouait a 1 s de la fin faisait expirer son chrono pendant le
// tour du bot, qui etait alors compte AFK puis exclu
export function continueTurn(
  ctx: GatewayContext,
  game: InternalGameState,
): void {
  if (game.status !== GameStatus.IN_PROGRESS) return;
  const next = game.players.find((p) => p.isCurrentTurn);
  if (!next) return;
  if (next.userId.startsWith("bot_")) {
    scheduleBotTurnIfNeeded(ctx, game, game.id);
  }
  // Pour un bot, ce chrono sert de filet de securite si son coup ne part pas
  ctx.startTurnTimer(game.id);
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
  setTimeout(() => {
    playBotTurn().catch((err) => {
      ctx.fastify.log.error({ err, botId, gameId }, "Bot turn failed");
    });
  }, botDelayMs());
}

// Delais des reactions hors tour, entre min et min + extra (ms)
function randomDelay(min: number, extra: number): number {
  return min + Math.random() * extra;
}

// Chance qu'un bot voie l'occasion (il n'est pas parfait)
const JUMP_IN_CHANCE = 0.5;
const CATCH_UNO_CHANCE = 0.7;

// Contexte d'un bot pour appeler les handlers : ses erreurs ne partent pas
// chez l'humain (le coup a pu devenir invalide pendant le delai)
function botContext(ctx: GatewayContext, botId: string): GatewayContext {
  return { ...ctx, userId: botId, sendError: () => {} };
}

// A appeler apres chaque carte posee : les bots reagissent hors de leur tour,
// comme un humain. Catch UNO : le joueur qui vient de poser est a 1 carte
// sans avoir dit UNO. Jump-in : un bot a la meme carte (couleur et valeur)
// que celle du dessus. Chaque reaction relit l'etat au declenchement, et les
// handlers verifient tout (fenetre UNO, coup valide) : une occasion passee ne
// fait rien.
export function scheduleBotReactions(
  ctx: GatewayContext,
  game: InternalGameState,
  playerId: string,
): void {
  if (game.status !== GameStatus.IN_PROGRESS) return;
  const gameId = game.id;
  const bots = game.players.filter(
    (p) => p.userId.startsWith("bot_") && !p.disconnected,
  );

  // Catch UNO : avant la fin de la fenetre de 5 s
  const player = game.players.find((p) => p.userId === playerId);
  if (
    game.settings.unoCallout &&
    player?.hand.length === 1 &&
    ctx.unoTimers.has(unoKey(gameId, playerId))
  ) {
    for (const bot of bots) {
      if (bot.userId === playerId || Math.random() >= CATCH_UNO_CHANCE)
        continue;
      setTimeout(
        () => {
          const now = ctx.manager.getGame(gameId);
          if (now?.status !== GameStatus.IN_PROGRESS) return;
          handleCatchUno(botContext(ctx, bot.userId), {
            gameId,
            targetUserId: playerId,
          });
        },
        randomDelay(1500, 2000),
      );
    }
  }

  // Jump-in : pas de joker (le moteur demande la meme couleur et valeur)
  if (game.settings.jumpIn && !game.lastWildDraw4) {
    const top = game.topCard;
    for (const bot of bots) {
      if (bot.isCurrentTurn) continue; // son tour normal s'en charge
      const copy = bot.hand.find(
        (c) =>
          c.color === top.color && c.value === top.value && c.color !== "wild",
      );
      if (!copy || Math.random() >= JUMP_IN_CHANCE) continue;
      setTimeout(
        () => {
          const now = ctx.manager.getGame(gameId);
          if (
            now?.status !== GameStatus.IN_PROGRESS ||
            now.topCard.id !== top.id ||
            now.lastWildDraw4
          )
            return;
          const me = now.players.find((p) => p.userId === bot.userId);
          if (!me || me.isCurrentTurn || !me.hand.some((c) => c.id === copy.id))
            return;
          const botCtx = botContext(ctx, bot.userId);
          handlePlayCard(botCtx, { gameId, cardId: copy.id })
            .then(() => {
              // Plus qu'une carte : il dit UNO (ou l'oublie), comme a son tour
              const after = ctx.manager.getGame(gameId);
              const mine = after?.players.find((p) => p.userId === bot.userId);
              if (
                after?.status === GameStatus.IN_PROGRESS &&
                after.settings.unoCallout &&
                mine &&
                shouldCallUno(mine.hand)
              )
                handleCallUno(botCtx, { gameId });
            })
            .catch((err) => {
              ctx.fastify.log.error(
                { err, botId: bot.userId, gameId },
                "Bot jump-in failed",
              );
            });
        },
        randomDelay(500, 1000),
      );
    }
  }
}
