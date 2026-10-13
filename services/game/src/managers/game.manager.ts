import type { GameMode, GameParticipant, GameSettings } from "shared";
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
  ): InternalGameState | null {
    const currentGameState = this.games.get(gameId);
    if (!currentGameState) return null;

    const actualisedGameState = engine.playCard(
      currentGameState,
      playerId,
      cardId,
      chosenColor,
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
}
