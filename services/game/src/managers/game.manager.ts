import {
  GameStatus,
  type GameMode,
  type GameParticipant,
  type GameSettings,
} from "shared";
import type { InternalGameState } from "../engine/game-state.js";
import * as engine from "../engine/game-state.js";

export class GameManager {
  private games: Map<string, InternalGameState> = new Map();

  createGame(
    participants: GameParticipant[],
    mode: GameMode,
    settings?: GameSettings,
  ): string | null {
    const game = engine.createGame(participants, mode, settings);
    this.games.set(game.id, game);
    return game.id;
  }

  getGame(gameId: string): InternalGameState | undefined {
    return this.games.get(gameId);
  }

  playCard(
    gameId: string,
    playerId: string,
    cardId: string,
    chosenColor?: string,
    targetUserId?: string,
  ): InternalGameState | null {
    const currentGameState = this.games.get(gameId);
    if (!currentGameState) return null;

    const actualisedGameState = engine.playCard(
      currentGameState,
      playerId,
      cardId,
      chosenColor,
      targetUserId,
    );

    return actualisedGameState;
  }

  drawCard(gameId: string, playerId: string): InternalGameState | null {
    const currentGameState = this.games.get(gameId);

    if (!currentGameState) return null;

    const actualisedGameState = engine.drawCard(currentGameState, playerId);

    return actualisedGameState;
  }

  removeGame(gameId: string): void {
    this.games.delete(gameId);
  }

  isPlayerInGame(userId: string): boolean {
    for (const game of this.games.values()) {
      if (game.status !== GameStatus.IN_PROGRESS) continue;
      const player = game.players.find((p) => p.userId === userId);
      if (player && !player.disconnected) return true;
    }
    return false;
  }
}
