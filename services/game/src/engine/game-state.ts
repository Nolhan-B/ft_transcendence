import {
  GameMode,
  GameState,
  GameStatus,
  GameSettings,
  CardColor,
} from "shared";
import { createDeck, dealCards, shuffleDeck } from "./deck.js";
import type { Card, DrawReason, GameAction, Player } from "shared";
import { v4 as uuid } from "uuid";
import { getCardEffect, isValidPlay } from "./rules.js";

// Champs de GameState calcules par le gateway au moment de l'envoi (timers,
// sockets) : ils ne sont pas stockes dans l'etat interne
export type LiveStateFields =
  | "turnTimeLeftMs"
  | "turnDurationMs"
  | "pendingWildDraw4"
  | "unoVulnerable"
  | "reconnecting";

export interface InternalGameState extends Omit<GameState, LiveStateFields> {
  drawPile: Card[];
  // Actions pas encore diffusees : elles deviennent lastActions au prochain envoi
  pendingActions: GameAction[];
  // Dernier numero d'action attribue dans la partie
  actionSeq: number;
  // Interne : sert a enregistrer la vraie duree de la partie (Match.startedAt)
  startedAt: Date;
  lastWildDraw4?: {
    playerId: string;
    hadMatchingColor: boolean;
    previousColor: CardColor;
    // Heure limite pour repondre (posee par le gateway avec le timer de bluff)
    expiresAt?: number;
  };
}

export function createGame(
  participants: { id: string; username: string; avatarUrl?: string | null }[],
  mode: GameMode,
  settings?: GameSettings,
): InternalGameState {
  const deck: Card[] = shuffleDeck(createDeck());
  const result = dealCards(deck, participants.length);
  const hands = result.hands;
  let remaining = result.remaining;

  let topCard = remaining.shift()!;

  while (topCard.color === "wild") {
    remaining.push(topCard);
    remaining = shuffleDeck(remaining);
    topCard = remaining.shift()!;
  }

  const players: Player[] = participants.map((p, i) => ({
    userId: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl ?? null,
    hand: hands[i],
    isCurrentTurn: i === 0,
    disconnected: false,
  }));

  const defaultSettings: GameSettings = {
    stacking: "none",
    sevenZeroRule: false,
    jumpIn: false,
    bluffChallenge: false,
    unoCallout: false,
  };

  return {
    id: uuid(),
    mode: mode,
    status: GameStatus.IN_PROGRESS,
    settings: settings ?? defaultSettings,
    players: players,
    currentColor: topCard.color,
    topCard: topCard,
    direction: 1,
    drawPileCount: remaining.length,
    discardPile: [topCard],
    drawPile: remaining,
    pendingDrawCount: 0,
    lastWildDraw4: undefined,
    ranking: [],
    winnerId: null,
    startedAt: new Date(),
    lastActions: [],
    pendingActions: [],
    actionSeq: 0,
  };
}

// Omit applique a chaque membre de l'union (Omit simple casserait le type par action)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

// Une action sans son numero : recordAction l'attribue
export type NewGameAction = DistributiveOmit<GameAction, "seq">;

// Note une action : elle sera envoyee dans lastActions au prochain etat diffuse
export function recordAction(
  state: InternalGameState,
  action: NewGameAction,
): void {
  state.actionSeq += 1;
  state.pendingActions.push({ ...action, seq: state.actionSeq } as GameAction);
}

// Fait piocher un joueur et note la pioche (avec les cartes, filtrees a l'envoi)
export function drawAndRecord(
  state: InternalGameState,
  playerId: string,
  count: number,
  reason: DrawReason,
  auto = false,
): Card[] {
  const cards = drawCardsForPlayer(state, playerId, count);
  recordAction(state, {
    type: "cards_drawn",
    userId: playerId,
    count: cards.length,
    reason,
    cards,
    ...(auto && { auto: true }),
  });
  return cards;
}

export function playCard(
  state: InternalGameState,
  playerId: string,
  cardId: string,
  chosenColor?: string,
  targetUserId?: string,
): InternalGameState | null {
  // PHASE 1 : tout verifier, sans rien modifier
  if (state.status === GameStatus.FINISHED) return null;

  // Un +4 attend une reponse (accept / challenge) : personne ne joue avant,
  // sinon la cible esquive la penalite (et un jump-in ecraserait le +4 en attente)
  if (state.lastWildDraw4) return null;

  const player: Player | undefined = getPlayer(state, playerId);
  if (!player || player.disconnected) return null;

  const playedCard: Card | undefined = getCardFromHand(player, cardId);
  if (!playedCard) return null;

  // Jump-in : on verifie seulement, le tour sera transfere en phase 2
  const isJumpIn = !player.isCurrentTurn;
  if (isJumpIn) {
    if (!state.settings.jumpIn) return null;
    if (
      playedCard.color !== state.topCard.color ||
      playedCard.value !== state.topCard.value
    )
      return null;
  }

  if (
    !isValidPlay(
      playedCard,
      state.topCard,
      state.currentColor,
      state.pendingDrawCount,
      state.settings.stacking,
    )
  )
    return null;

  const effect = getCardEffect(playedCard);
  const validColors = ["red", "yellow", "green", "blue"];

  // Joker et +4 : une couleur valide est obligatoire
  if (effect.type === "wild" || effect.type === "wild_draw") {
    if (!chosenColor || !validColors.includes(chosenColor)) return null;
  }

  // Regle 7-0 : le 7 a besoin d'une cible valide, qui n'est pas le joueur lui-meme
  const isSwap = state.settings.sevenZeroRule && playedCard.value === "7";
  if (isSwap) {
    if (!targetUserId || targetUserId === player.userId) return null;
    const target = getPlayer(state, targetUserId);
    if (!target || target.disconnected) return null;
  }

  // PHASE 2 : appliquer le coup (plus aucun return null apres ici)
  if (isJumpIn) {
    const currentPlayer = state.players.find((p) => p.isCurrentTurn);
    if (currentPlayer) currentPlayer.isCurrentTurn = false;
    player.isCurrentTurn = true;
  }

  // Check bluff avant de retirer la carte de la main
  const hadMatchingColorBeforePlay =
    playedCard.value === "wild_draw4"
      ? player.hand.some(
          (c) => c.color === state.currentColor && c.id !== cardId,
        )
      : false;

  removeCardFromHand(player, cardId);

  state.topCard = playedCard;
  state.discardPile.push(playedCard);

  recordAction(state, {
    type: "card_played",
    userId: player.userId,
    card: playedCard,
    ...((effect.type === "wild" || effect.type === "wild_draw") && {
      chosenColor: chosenColor as CardColor,
    }),
    ...(isSwap && { targetUserId }),
    ...(isJumpIn && { jumpIn: true }),
  });

  switch (effect.type) {
    case "none":
      // Derniere carte posee : le joueur a fini, pas d'echange ni de rotation
      // (sinon il recupererait une main et l'autre joueur resterait a 0 carte)
      if (player.hand.length === 0) {
        // rien a faire, la victoire est geree plus bas
      } else if (isSwap) {
        swapHands(state, player.userId, targetUserId!);
        recordAction(state, {
          type: "hands_swapped",
          userId: player.userId,
          targetUserId: targetUserId!,
        });
      } else if (state.settings.sevenZeroRule && playedCard.value === "0") {
        rotateHands(state);
        recordAction(state, {
          type: "hands_rotated",
          direction: state.direction,
        });
      }
      advanceToNextPlayer(state);
      break;
    case "skip":
      advanceToNextPlayer(state);
      advanceToNextPlayer(state);
      break;
    case "reverse":
      if (state.players.filter((p) => !p.disconnected).length === 2) {
        advanceToNextPlayer(state);
        advanceToNextPlayer(state);
      } else {
        changeDirection(state);
        advanceToNextPlayer(state);
      }
      break;
    case "draw":
      if (state.settings.stacking === "none") {
        advanceToNextPlayer(state);
        drawForCurrentPlayer(state, effect.count, "draw2");
        advanceToNextPlayer(state);
      } else {
        state.pendingDrawCount += effect.count;
        advanceToNextPlayer(state);
      }
      break;
    case "wild":
      state.currentColor = chosenColor as CardColor;
      advanceToNextPlayer(state);
      break;
    case "wild_draw": {
      const previousColor = state.currentColor;
      state.currentColor = chosenColor as CardColor;

      if (state.pendingDrawCount > 0) {
        // +4 pose sur une pile en cours : il s'ajoute a la pile. Pas de bluff
        // possible, le coup est autorise par le stacking et non par la couleur
        // (sinon la pile restait en attente apres l'accept du +4)
        state.pendingDrawCount += effect.count;
        advanceToNextPlayer(state);
      } else if (state.settings.bluffChallenge) {
        // Stocker l'info pour un eventuel challenge, ne pas faire piocher
        state.lastWildDraw4 = {
          playerId: player.userId,
          hadMatchingColor: hadMatchingColorBeforePlay,
          previousColor,
        };
        advanceToNextPlayer(state);
      } else if (state.settings.stacking === "none") {
        advanceToNextPlayer(state);
        drawForCurrentPlayer(state, effect.count, "wild_draw4");
        advanceToNextPlayer(state);
      } else {
        state.pendingDrawCount += effect.count;
        advanceToNextPlayer(state);
      }
      break;
    }
  }

  if (effect.type !== "wild" && effect.type !== "wild_draw") {
    state.currentColor = playedCard.color;
  }

  if (player.hand.length === 0) {
    finishPlayer(state, player.userId);

    if (state.mode === GameMode.CLASSIC) {
      state.winnerId = player.userId;
      state.status = GameStatus.FINISHED;
    } else {
      player.disconnected = true;
      const activePlayers = state.players.filter((p) => !p.disconnected);
      if (activePlayers.length <= 1) {
        if (activePlayers.length === 1) {
          finishPlayer(state, activePlayers[0].userId);
        }
        state.winnerId = state.ranking[0];
        state.status = GameStatus.FINISHED;
      }
    }
  }

  state.drawPileCount = state.drawPile.length;

  return state;
}

function getPlayer(
  state: InternalGameState,
  playerId: string,
): Player | undefined {
  return state.players.find((p) => p.userId === playerId);
}

function getActivePlayers(state: InternalGameState): Player[] {
  return state.players.filter((p) => !p.disconnected);
}

function getCardFromHand(player: Player, cardId: string): Card | undefined {
  return player.hand.find((c) => c.id === cardId);
}

function removeCardFromHand(player: Player, cardId: string): Card | undefined {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index === -1) return undefined;
  return player.hand.splice(index, 1)[0];
}

export function advanceToNextPlayer(state: InternalGameState): void {
  const currentIndex = state.players.findIndex((p) => p.isCurrentTurn);
  state.players[currentIndex].isCurrentTurn = false;

  let nextIndex = currentIndex;
  do {
    nextIndex =
      (nextIndex + state.direction + state.players.length) %
      state.players.length;
  } while (state.players[nextIndex].disconnected);

  state.players[nextIndex].isCurrentTurn = true;
}

function changeDirection(state: InternalGameState): void {
  state.direction = state.direction === 1 ? -1 : 1;
}

// Pioche brute, sans action notee : utiliser drawAndRecord pour un coup de jeu.
// Renvoie les cartes reellement piochees (moins si la pioche est vide)
export function drawCardsForPlayer(
  state: InternalGameState,
  playerId: string,
  count: number,
): Card[] {
  const player = state.players.find((p) => p.userId === playerId);
  if (!player) return [];

  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      const topCard = state.discardPile.pop()!;
      state.drawPile = shuffleDeck(state.discardPile);
      state.discardPile = [topCard];
    }
    const card = state.drawPile.shift();
    if (card) {
      player.hand.push(card);
      drawn.push(card);
    }
  }

  state.drawPileCount = state.drawPile.length;
  return drawn;
}

function drawForCurrentPlayer(
  state: InternalGameState,
  count: number,
  reason: DrawReason,
  auto = false,
): void {
  const player = state.players.find((p) => p.isCurrentTurn);
  if (!player) return;
  drawAndRecord(state, player.userId, count, reason, auto);
}

// Classe le joueur (il a fini, ou il est le dernier en jeu) et le note
export function finishPlayer(state: InternalGameState, userId: string): void {
  state.ranking.push(userId);
  recordAction(state, {
    type: "player_finished",
    userId,
    rank: state.ranking.length,
  });
}

// auto : pioche forcee par le chrono du tour (AFK)
export function drawCard(
  state: InternalGameState,
  playerId: string,
  auto = false,
): InternalGameState | null {
  const player = getPlayer(state, playerId);
  if (!player || player.disconnected) return null;
  if (!player.isCurrentTurn) return null;
  // Face a un +4 contestable, il faut passer par accept_wild_draw4 ou challenge_bluff
  if (state.lastWildDraw4) return null;

  const stacked = state.pendingDrawCount > 0;
  const count = stacked ? state.pendingDrawCount : 1;
  const reason: DrawReason = auto ? "afk" : stacked ? "stack" : "voluntary";
  drawForCurrentPlayer(state, count, reason, auto);
  state.pendingDrawCount = 0;
  advanceToNextPlayer(state);

  return state;
}

export function swapHands(
  state: InternalGameState,
  playerOneId: string,
  playerTwoId: string,
): void {
  const playerOne = getPlayer(state, playerOneId);
  const playerTwo = getPlayer(state, playerTwoId);

  [playerOne!.hand, playerTwo!.hand] = [playerTwo!.hand, playerOne!.hand];
}

function rotateHands(state: InternalGameState): void {
  const activePlayers = getActivePlayers(state);
  if (activePlayers.length < 2) return;
  const hands = activePlayers.map((p) => p.hand);

  if (state.direction === 1) {
    const last = hands.pop()!;
    hands.unshift(last);
  } else {
    const first = hands.shift()!;
    hands.push(first);
  }

  for (let i = 0; i < activePlayers.length; i++) {
    activePlayers[i].hand = hands[i];
  }
}
