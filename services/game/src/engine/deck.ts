import { v4 as uuid } from "uuid";
import type { Card, CardColor, CardValue } from "shared";

const COLORS: CardColor[] = ["red", "yellow", "green", "blue"];

const NUMBERED_VALUES: CardValue[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];
const ACTION_VALUES: CardValue[] = ["skip", "reverse", "draw2"];
const WILD_VALUES: CardValue[] = ["wild", "wild_draw4"];

function createCard(color: CardColor, value: CardValue): Card {
  return { id: uuid(), color, value };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    // Un seul 0 par couleur
    deck.push(createCard(color, "0"));

    // Deux de chaque 1-9
    for (const value of NUMBERED_VALUES) {
      if (value === "0") continue;
      deck.push(createCard(color, value));
      deck.push(createCard(color, value));
    }

    // Deux de chaque action
    for (const value of ACTION_VALUES) {
      deck.push(createCard(color, value));
      deck.push(createCard(color, value));
    }
  }

  // 4 wild, 4 wild_draw4
  for (const value of WILD_VALUES) {
    for (let i = 0; i < 4; i++) {
      deck.push(createCard("wild", value));
    }
  }

  return deck;
}

// Algo de Fisher-Yates
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number = 7,
): { hands: Card[][]; remaining: Card[] } {
  const remaining = [...deck];
  const hands: Card[][] = [];

  for (let i = 0; i < numPlayers; i++) {
    hands.push(remaining.splice(0, cardsPerPlayer));
  }

  return { hands, remaining };
}
