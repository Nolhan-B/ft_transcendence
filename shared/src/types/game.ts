export type CardColor = "red" | "yellow" | "green" | "blue" | "wild";

export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild_draw4";

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export enum GameMode {
  CLASSIC = "classic",
  RANKED = "ranked",
}

export enum GameStatus {
  WAITING = "waiting",
  IN_PROGRESS = "in_progress",
  FINISHED = "finished",
}

export interface Player {
  userId: string;
  username: string;
  // Profile picture when the game started (null: none, or a bot)
  avatarUrl?: string | null;
  hand: Card[];
  isCurrentTurn: boolean;
  disconnected: boolean;
}

export type StackingRule = "none" | "same" | "all";

export interface GameSettings {
  stacking: StackingRule;
  sevenZeroRule: boolean;
  jumpIn: boolean;
  bluffChallenge: boolean;
  unoCallout: boolean;
}

// ============================================================
// ACTIONS - ce qui vient de se passer, pour que tous les clients
// (joueurs, spectateurs, reconnexion) affichent la meme chose
// ============================================================

// Pourquoi un joueur pioche
export type DrawReason =
  | "voluntary" // draw_card sans pile en cours
  | "stack" // draw_card face a une pile de +2/+4 (stacking)
  | "draw2" // +2 subi, stacking desactive
  | "wild_draw4" // +4 subi : sans bluff, accepte, ou timer de bluff expire
  | "bluff_penalty" // challenge : le poseur bluffait (4) ou le challenger avait tort (6)
  | "uno_penalty" // attrape sans avoir dit UNO
  | "afk"; // chrono du tour expire

export type KickReason =
  | "afk" // trop de tours sans jouer
  | "abandoned"; // pas revenu apres le delai de reconnexion

interface GameActionBase {
  // Numero croissant dans la partie : un client ignore les actions deja
  // affichees (ex : l'etat renvoye a la reconnexion contient les memes)
  seq: number;
  // true si l'action vient du serveur (timer) et pas d'un joueur
  auto?: boolean;
}

export type GameAction = GameActionBase &
  (
    | {
        type: "card_played";
        userId: string;
        card: Card;
        chosenColor?: CardColor; // joker / +4
        targetUserId?: string; // 7 avec la regle 7-0
        jumpIn?: boolean;
      }
    | {
        type: "cards_drawn";
        userId: string;
        count: number;
        reason: DrawReason;
        cards?: Card[]; // uniquement dans l'etat envoye a celui qui pioche
      }
    | { type: "hands_swapped"; userId: string; targetUserId: string }
    | { type: "hands_rotated"; direction: 1 | -1 }
    | { type: "uno_called"; userId: string }
    | { type: "uno_caught"; userId: string; targetUserId: string }
    | {
        type: "bluff_challenged";
        userId: string; // le challenger
        targetUserId: string; // le poseur du +4
        wasBluff: boolean;
      }
    | { type: "wild_draw4_accepted"; userId: string }
    | { type: "player_finished"; userId: string; rank: number }
    | { type: "player_kicked"; userId: string; reason: KickReason }
  );

// +4 en attente d'une reponse (regle du bluff). Ne contient volontairement
// pas l'info "avait la couleur", qui doit rester secrete
export interface PendingWildDraw4 {
  playerId: string; // qui a pose le +4
  targetId: string; // qui doit accepter ou contester
  timeLeftMs: number;
}

export interface GameState {
  id: string;
  mode: GameMode;
  status: GameStatus;
  settings: GameSettings;
  players: Player[];
  currentColor: CardColor;
  pendingDrawCount: number;
  topCard: Card;
  direction: 1 | -1;
  drawPileCount: number;
  discardPile: Card[];
  ranking: string[]; // ordre d'arrivee / [winnerId] en mode classic, rempli progressivement en ranked
  winnerId: string | null;
  // Actions qui ont produit cet etat, dans l'ordre (souvent une seule,
  // plusieurs pour un +2 : carte jouee puis pioche du suivant)
  lastActions: GameAction[];
  // Temps restant du tour au moment de l'envoi (null : pas de chrono, ex bot)
  turnTimeLeftMs: number | null;
  // Duree complete d'un tour sur le serveur (TURN_TIMEOUT_MS), pour le cercle
  turnDurationMs: number;
  pendingWildDraw4: PendingWildDraw4 | null;
  // Joueurs a 1 carte qui n'ont pas dit UNO et peuvent encore etre attrapes
  unoVulnerable: string[];
  // Joueurs deconnectes en attente de reconnexion (pas encore exclus)
  reconnecting: string[];
}

// One player of a finished game, as the history gives it
export interface MatchParticipant {
  id: string;
  // Current username for an account, the name of the time for a bot or a
  // deleted account
  username: string;
  avatarUrl: string | null;
  isBot: boolean;
  // Account deleted since the game
  deleted: boolean;
  // Ranked games: ELO before and after the game (null in classic)
  oldElo: number | null;
  newElo: number | null;
}

export interface Match {
  id: string;
  mode: GameMode;
  players: string[];
  // Same players as `players`, same order, with their names and ELO changes
  participants: MatchParticipant[];
  ranking: string[];
  winnerId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export type AchievementId =
  | "first_win"
  | "games_10"
  | "games_50"
  | "streak_5"
  | "full_table_win"
  | "first_ranked_win"
  | "elo_1200"
  | "beat_a_bot"
  | "speed_win"
  | "marathon"
  | "comeback"
  | "social_10"
  | "games_100"
  | "elo_1500";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  unlocked: boolean;
  // When it was unlocked (the end of the game that did it), null if locked
  unlockedAt: string | null;
  // Where the player stands, for the locked ones (e.g. 7 / 10 games)
  progress: number;
  goal: number;
}

export interface GameParticipant {
  id: string;
  username: string;
  avatarUrl?: string | null;
}
