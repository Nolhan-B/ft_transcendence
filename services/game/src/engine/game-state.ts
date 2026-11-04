import {
  GameMode,
  GameState,
  GameStatus,
  GameSettings,
  CardColor,
} from "shared";
import { createDeck, dealCards, shuffleDeck } from "./deck.js";
import type { Card, Player } from "shared";
import { v4 as uuid } from "uuid";
import { getCardEffect, isValidPlay } from "./rules.js";

export interface InternalGameState extends GameState {
  drawPile: Card[];
  lastWildDraw4?: {
    playerId: string;
    hadMatchingColor: boolean;
    previousColor: CardColor;
  };
}

export function createGame(
  participants: { id: string; username: string }[],
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
  };
}

export function playCard(
  state: InternalGameState,
  playerId: string,
  cardId: string,
  chosenColor?: string,
  targetUserId?: string,
): InternalGameState | null {
  if (state.status === GameStatus.FINISHED) return null;

  const player: Player | undefined = getPlayer(state, playerId);

  if (!player || player.disconnected) return null;
  const playedCard: Card | undefined = getCardFromHand(player, cardId);
  if (!playedCard) return null;

  if (!player.isCurrentTurn) {
    if (!state.settings.jumpIn) return null;
    if (
      playedCard.color !== state.topCard.color ||
      playedCard.value !== state.topCard.value
    )
      return null;

    const currentPlayer = state.players.find((p) => p.isCurrentTurn);
    if (currentPlayer) currentPlayer.isCurrentTurn = false;
    player.isCurrentTurn = true;
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

  const validColors = ["red", "yellow", "green", "blue"];
  const effect = getCardEffect(playedCard);

  switch (effect.type) {
    case "none":
      if (state.settings.sevenZeroRule && playedCard.value === "7") {
        if (!targetUserId) return null;
        const target = getPlayer(state, targetUserId);
        if (!target || target.disconnected) return null;
        swapHands(state, player.userId, target.userId);
      } else if (state.settings.sevenZeroRule && playedCard.value === "0") {
        rotateHands(state);
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
        drawCardsForCurrentPlayer(state, effect.count);
        advanceToNextPlayer(state);
      } else {
        state.pendingDrawCount += effect.count;
        advanceToNextPlayer(state);
      }
      break;
    case "wild":
      if (!chosenColor || !validColors.includes(chosenColor)) return null;
      state.currentColor = chosenColor as CardColor;
      advanceToNextPlayer(state);
      break;
    case "wild_draw": {
      if (!chosenColor) return null;
      const previousColor = state.currentColor;
      state.currentColor = chosenColor as CardColor;

      if (state.settings.bluffChallenge) {
        // Stocker l'info pour un éventuel challenge, ne pas faire piocher
        state.lastWildDraw4 = {
          playerId: player.userId,
          hadMatchingColor: hadMatchingColorBeforePlay,
          previousColor,
        };
        advanceToNextPlayer(state);
      } else if (state.settings.stacking === "none") {
        advanceToNextPlayer(state);
        drawCardsForCurrentPlayer(state, effect.count);
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
    state.ranking.push(player.userId);

    if (state.mode === GameMode.CLASSIC) {
      state.winnerId = player.userId;
      state.status = GameStatus.FINISHED;
    } else {
      player.disconnected = true;
      const activePlayers = state.players.filter((p) => !p.disconnected);
      if (activePlayers.length <= 1) {
        if (activePlayers.length === 1) {
          state.ranking.push(activePlayers[0].userId);
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

export function drawCardsForPlayer(
  state: InternalGameState,
  playerId: string,
  count: number,
): void {
  const player = state.players.find((p) => p.userId === playerId);
  if (!player) return;

  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      const topCard = state.discardPile.pop()!;
      state.drawPile = shuffleDeck(state.discardPile);
      state.discardPile = [topCard];
    }
    const card = state.drawPile.shift();
    if (card) player.hand.push(card);
  }

  state.drawPileCount = state.drawPile.length;
}

function drawCardsForCurrentPlayer(
  state: InternalGameState,
  count: number,
): void {
  const player = state.players.find((p) => p.isCurrentTurn);
  if (!player) return;
  drawCardsForPlayer(state, player.userId, count);
}

export function drawCard(
  state: InternalGameState,
  playerId: string,
): InternalGameState | null {
  const player = getPlayer(state, playerId);
  if (!player || player.disconnected) return null;
  if (!player.isCurrentTurn) return null;

  const count = state.pendingDrawCount > 0 ? state.pendingDrawCount : 1;
  drawCardsForCurrentPlayer(state, count);
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
