import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { GameManager } from "../managers/game.manager.js";
import { Room, RoomManager } from "../managers/room.manager.js";
import { InternalGameState } from "../engine/game-state.js";
import { RoomInfo, ServerEvent } from "shared";

export interface GatewayContext {
  fastify: FastifyInstance;
  socket: WebSocket;
  userId: string;
  manager: GameManager;
  roomManager: RoomManager;
  rooms: Map<string, Set<{ socket: WebSocket; userId: string }>>;
  roomSockets: Map<string, Set<{ socket: WebSocket; userId: string }>>;
  chatLogs: Map<
    string,
    { userId: string; username: string; content: string; time: string }[]
  >;
  moveLogs: Map<
    string,
    {
      userId: string;
      action: string;
      cardId?: string;
      cardColor?: string;
      cardValue?: string;
      chosenColor?: string;
      time: string;
    }[]
  >;
  unoTimers: Map<string, NodeJS.Timeout>;
  bluffTimers: Map<string, NodeJS.Timeout>;
  turnTimers: Map<string, NodeJS.Timeout>;
  afkCounts: Map<string, number>;
  broadCastToRoom: (
    gameId: string,
    event: ServerEvent,
    excludeUserId?: string,
  ) => void;
  broadCastStateToRoom: (gameId: string, state: InternalGameState) => void;
  broadcastToRoomSockets: (roomCode: string, event: ServerEvent) => void;
  toRoomInfo: (room: Room) => RoomInfo;
  sendError: (socket: WebSocket, message: string) => void;
  startTurnTimer: (gameId: string) => void;
  endGame: (gameId: string, game: InternalGameState) => Promise<void>;
}
