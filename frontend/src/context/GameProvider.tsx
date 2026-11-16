import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CardColor,
  CreateRoomPayload,
  GameSettings,
  GameState,
  RoomInfo,
  ServerEvent,
} from "shared";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { GameContext } from "./GameContext";
import type { GameContextValue } from "./GameContext";

// The server closes the socket after these refusals. "Already connected" is
// often only a race (page reload, hot reload: the old socket is not closed yet
// on the server), so it is retried a few times before giving up.
const ALWAYS_FATAL = ["Unauthorized", "Invalid token"];
const MAX_REFUSALS = 3;

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consecutive "Already connected" answers (reset once the server accepts us)
  const refusals = useRef(0);

  const { status, send } = useWebSocket({
    path: "/api/game/ws",
    isFatal: (message) => {
      const event = message as ServerEvent;
      return (
        event.type === "error" &&
        (ALWAYS_FATAL.includes(event.message) ||
          (event.message === "Already connected" &&
            refusals.current >= MAX_REFUSALS))
      );
    },
    onMessage: (message) => {
      // Not part of ServerEvent: sent by the server once it accepts the socket
      if ((message as { type?: string }).type === "connected") {
        refusals.current = 0;
        return;
      }
      const event = message as ServerEvent;
      switch (event.type) {
        case "room_updated":
          setRoom(event.room);
          break;
        case "game_started":
          setGameId(event.gameId);
          // New game: forget the previous one
          setGameState(null);
          setWinnerId(null);
          // The server removes the room when the game starts
          setRoom(null);
          break;
        case "game_updated":
          setGameState(event.state);
          break;
        case "game_ended":
          setWinnerId(event.winnerId);
          break;
        case "queue_joined":
          setInQueue(true);
          break;
        case "queue_left":
          setInQueue(false);
          break;
        case "match_found":
          setInQueue(false);
          setGameId(event.gameId);
          setGameState(null);
          setWinnerId(null);
          break;
        case "error":
          if (event.message === "Already connected") {
            refusals.current++;
            // Still retrying: stay silent
            if (refusals.current < MAX_REFUSALS) break;
            setError(
              "The game is already open in another tab or window. Close it, then reload this page.",
            );
            break;
          }
          setError(event.message);
          break;
      }
    },
  });

  const createRoom = useCallback(
    (payload: CreateRoomPayload) => {
      setError(null);
      send({ type: "create_room", ...payload });
    },
    [send],
  );

  const joinRoom = useCallback(
    (roomCode: string, password?: string) => {
      setError(null);
      send({ type: "join_room", roomCode, password });
    },
    [send],
  );

  const leaveRoom = useCallback(() => {
    if (!room) return;
    send({ type: "leave_room", roomCode: room.code });
    setRoom(null);
  }, [send, room]);

  const startGame = useCallback(() => {
    if (!room) return;
    send({ type: "start_game", roomCode: room.code });
  }, [send, room]);

  const updateSettings = useCallback(
    (settings: GameSettings) => {
      if (!room) return;
      send({ type: "update_room", roomCode: room.code, settings });
    },
    [send, room],
  );

  const addBot = useCallback(() => {
    if (!room) return;
    send({ type: "add_bot", roomCode: room.code });
  }, [send, room]);

  const removeBot = useCallback(
    (botId: string) => {
      if (!room) return;
      send({ type: "remove_bot", roomCode: room.code, botId });
    },
    [send, room],
  );

  const joinQueue = useCallback(() => {
    setError(null);
    send({ type: "join_queue" });
  }, [send]);

  const leaveQueue = useCallback(() => {
    send({ type: "leave_queue" });
  }, [send]);

  const joinGame = useCallback(
    (id: string) => {
      send({ type: "join_game", gameId: id });
    },
    [send],
  );

  const playCard = useCallback(
    (
      cardId: string,
      options?: { chosenColor?: CardColor; targetUserId?: string },
    ) => {
      if (!gameId) return;
      setError(null);
      send({ type: "play_card", gameId, cardId, ...options });
    },
    [send, gameId],
  );

  const drawCard = useCallback(() => {
    if (!gameId) return;
    setError(null);
    send({ type: "draw_card", gameId });
  }, [send, gameId]);

  const callUno = useCallback(() => {
    if (!gameId) return;
    send({ type: "call_uno", gameId });
  }, [send, gameId]);

  const catchUno = useCallback(
    (targetUserId: string) => {
      if (!gameId) return;
      send({ type: "catch_uno", gameId, targetUserId });
    },
    [send, gameId],
  );

  const clearGame = useCallback(() => {
    setGameId(null);
    setGameState(null);
    setWinnerId(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<GameContextValue>(
    () => ({
      status,
      room,
      gameId,
      gameState,
      winnerId,
      inQueue,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      updateSettings,
      addBot,
      removeBot,
      joinQueue,
      leaveQueue,
      joinGame,
      playCard,
      drawCard,
      callUno,
      catchUno,
      clearGame,
    }),
    [
      status,
      room,
      gameId,
      gameState,
      winnerId,
      inQueue,
      error,
      clearError,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      updateSettings,
      addBot,
      removeBot,
      joinQueue,
      leaveQueue,
      joinGame,
      playCard,
      drawCard,
      callUno,
      catchUno,
      clearGame,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
