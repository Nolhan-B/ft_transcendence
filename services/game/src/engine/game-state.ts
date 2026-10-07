//
//
//
//
// TODO: Implémenter les settings
// (stacking,
//  multiplePlay,
//  sevenZeroRule,
//  jumpIn,
//  bluffChallenge,
//  unoCallout)
//
//
//
//
//

import {
  GameMode,
  GameState,
  GameStatus,
  GameSettings,
  CardColor,
} from 'shared';
import { createDeck, dealCards, shuffleDeck } from './deck.js';
import type { Card, Player } from 'shared';
import { v4 as uuid } from 'uuid';
import { getCardEffect, isValidPlay } from './rules.js';

export interface InternalGameState extends GameState {
  drawPile: Card[];
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

  while (topCard.color === 'wild') {
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
    stacking: false,
    multiplePlay: false,
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
    ranking: [],
    winnerId: null,
  };
}

export function playCard(
  state: InternalGameState,
  playerId: string,
  cardId: string,
  chosenColor?: string,
): InternalGameState | null {
  const player: Player | undefined = getPlayer(state, playerId);
  if (!player || player.disconnected) return null;

  const playedCard: Card | undefined = getCardFromHand(player, cardId);
  if (!playedCard) return null;

  if (!isValidPlay(playedCard, state.topCard, state.currentColor)) return null;

  removeCardFromHand(player, cardId);

  state.topCard = playedCard;
  state.discardPile.push(playedCard);

  const effect = getCardEffect(playedCard);

  switch (effect.type) {
    case 'none':
      advanceToNextPlayer(state);
      break;
    case 'skip':
      advanceToNextPlayer(state);
      advanceToNextPlayer(state);
      break;
    case 'reverse':
      changeDirection(state);
      advanceToNextPlayer(state);
      break;
    case 'draw':
      advanceToNextPlayer(state);
      drawCardsForCurrentPlayer(state, effect.count);
      advanceToNextPlayer(state);
      break;
    case 'wild':
      if (!chosenColor) return null;
      state.currentColor = chosenColor as CardColor;
      advanceToNextPlayer(state);
      break;
    case 'wild_draw':
      if (!chosenColor) return null;
      state.currentColor = chosenColor as CardColor;
      advanceToNextPlayer(state);
      drawCardsForCurrentPlayer(state, effect.count);
      advanceToNextPlayer(state);
      break;
  }

  if (effect.type !== 'wild' && effect.type !== 'wild_draw') {
    state.currentColor = playedCard.color;
  }

  if (player.hand.length === 0) {
    state.ranking.push(player.userId);

    if (state.mode === GameMode.CLASSIC) {
      state.winnerId = player.userId;
      state.status = GameStatus.FINISHED;
    } else {
      // Ranked : le joueur sort, la partie continue
      player.disconnected = true; // il ne joue plus
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

function getCardFromHand(player: Player, cardId: string): Card | undefined {
  return player.hand.find((c) => c.id === cardId);
}

function removeCardFromHand(player: Player, cardId: string): Card | undefined {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index === -1) return undefined;
  return player.hand.splice(index, 1)[0];
}

function advanceToNextPlayer(state: InternalGameState): void {
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

function drawCardsForCurrentPlayer(
  state: InternalGameState,
  count: number,
): void {
  const player = state.players.find((p) => p.isCurrentTurn);
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

export function drawCard(
  state: InternalGameState,
  playerId: string,
): InternalGameState | null {
  const player = getPlayer(state, playerId);
  if (!player || player.disconnected) return null;
  if (!player.isCurrentTurn) return null;

  drawCardsForCurrentPlayer(state, 1);
  advanceToNextPlayer(state);

  return state;
}
