import { GameMode, GameState, GameStatus } from 'shared';
import { createDeck, dealCards, shuffleDeck } from './deck';
import type { Card, Player } from 'shared';
import { v4 as uuid } from 'uuid';
import { isValidPlay } from './rules';

export interface InternalGameState extends GameState {
  drawPile: Card[];
}

export function createGame(
  participants: { id: string; username: string }[],
  mode: GameMode,
): InternalGameState {
  let deck: Card[] = shuffleDeck(createDeck());
  let { hands, remaining } = dealCards(deck, participants.length);

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

  return {
    id: uuid(),
    mode: mode,
    status: GameStatus.IN_PROGRESS,
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

  removeCardFromHand(player, cardId)

  // TODO: a finir
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
