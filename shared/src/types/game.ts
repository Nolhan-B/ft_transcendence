export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild_draw4';

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export type GameMode = 'classic' | 'ranked';
export type GameStatus = 'waiting' | 'in_progress' | 'finished';

export interface Player {
  userId: string;
  username: string;
  hand: Card[];
  isCurrentTurn: boolean;
}

export interface GameState {
  id: string;
  mode: GameMode;
  status: GameStatus;
  players: Player[];
  currentColor: CardColor;
  topCard: Card;
  direction: 1 | -1;
  drawPileCount: number;
  discardPile: Card[];
  ranking: string[]; // ordre d'arrivee / [winnerId] en mode classic, rempli progressivement en ranked
  winnerId: string | null;
}

export interface Match {
  id: string;
  mode: GameMode;
  players: string[];
  ranking: string[];
  winnerId: string | null;
  startedAt: string;
  endedAt: string | null;
}
