import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CardColor,
  ChatMessageEvent,
  CreateRoomPayload,
  GameSettings,
  GameState,
  RoomInfo,
  ServerEvent,
} from "shared";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { GameContext } from "./GameContext";
import type { GameContextValue, RefusedGame, UnoEvent } from "./GameContext";
import { useAuth } from "../hooks/auth/useAuth";

// The server closes the socket after these refusals. "Already connected" is
// often only a race (page reload, hot reload: the old socket is not closed yet
// on the server), so it is retried a few times before giving up.
const ALWAYS_FATAL = ["Unauthorized", "Invalid token"];
const MAX_REFUSALS = 3;

// The game in progress, kept in the browser: after a reload the player can
// go back to it (the server does not say which game we are in)
const STORED_GAME = "sns.currentGame";
// Answers to join_game for a game that no longer accepts us
const GONE = ["Game not found", "You are not part of this game"];

function storedGame(): string | null {
  try {
    return localStorage.getItem(STORED_GAME);
  } catch {
    return null;
  }
}

function storeGame(id: string | null) {
  try {
    if (id) localStorage.setItem(STORED_GAME, id);
    else localStorage.removeItem(STORED_GAME);
  } catch {
    // Storage blocked (private mode...): only the reload case is lost
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [unoCalls, setUnoCalls] = useState<Record<string, number>>({});
  const [unoEvent, setUnoEvent] = useState<UnoEvent | null>(null);
  const unoEventId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageEvent[]>([]);
  const [refusedGame, setRefusedGame] = useState<RefusedGame | null>(null);
  // Game asked with join_game whose first state has not arrived yet: a
  // refusal now is about it (not about an action in a game in progress)
  const joining = useRef<string | null>(null);
  // Game asked with spectate_game, until its first state arrives
  const watching = useRef<string | null>(null);

  // Consecutive "Already connected" answers (reset once the server accepts us)
  const refusals = useRef(0);
  // Game joined on the current socket: joining twice would register the
  // socket twice on the server, and every event would arrive twice
  const joinedOn = useRef<string | null>(null);
  // Stored game we are trying to join back after a reload
  const restoring = useRef<string | null>(null);

  const { refresh } = useAuth();

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
        // Back from a reload: join the stored game again, so that we stay in
        // it (unless the game page already did)
        const stored = storedGame();
        if (stored && joinedOn.current === null) {
          restoring.current = stored;
          joinedOn.current = stored;
          send({ type: "join_game", gameId: stored });
        }
        return;
      }
      const event = message as ServerEvent;
      switch (event.type) {
        case "room_updated":
          setRoom(event.room);
          break;
        case "game_started":
          setGameId(event.gameId);
          storeGame(event.gameId);
          // New game: forget the previous one
          setGameState(null);
          setWinnerId(null);
          setUnoCalls({});
          setUnoEvent(null);
          setChatMessages([]);
          // The server removes the room when the game starts
          setRoom(null);
          break;
        case "spectate_started":
          if (watching.current === event.state.id) watching.current = null;
          setGameState(event.state);
          setTurnStartedAt(Date.now());
          break;
        case "game_updated":
          if (joining.current === event.state.id) joining.current = null;
          if (restoring.current === event.state.id) {
            restoring.current = null;
            setGameId(event.state.id);
          }
          setGameState(event.state);
          setTurnStartedAt(Date.now());
          break;
        case "uno_called":
          setUnoCalls((calls) => ({ ...calls, [event.userId]: Date.now() }));
          setUnoEvent({
            id: ++unoEventId.current,
            kind: "called",
            userId: event.userId,
          });
          break;
        case "uno_caught":
          setUnoEvent({
            id: ++unoEventId.current,
            kind: "caught",
            userId: event.targetUserId,
            byUserId: event.catcherUserId,
          });
          break;
        case "game_ended":
          storeGame(null);
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
          storeGame(event.gameId);
          setGameState(null);
          setWinnerId(null);
          setUnoCalls({});
          setUnoEvent(null);
          setChatMessages([]);
          break;
        case "chat_message":
          setChatMessages((prev) => [...prev, event]);
          break;
        case "elo_updated":
          void refresh();
          break ;
        case "error":
          // The stored game is over: forget it without bothering the user
          if (restoring.current && GONE.includes(event.message)) {
            // Shown only if the game page is open on this game (reload)
            setRefusedGame({
              id: restoring.current,
              reason: event.message === GONE[0] ? "not_found" : "not_player",
            });
            restoring.current = null;
            joinedOn.current = null;
            storeGame(null);
            break;
          }
          // The game we are opening does not exist or is not ours: the game
          // page says it in full screen, no toast
          // The game we want to watch is over, or we play in it
          if (
            watching.current &&
            (event.message === GONE[0] ||
              event.message === "You are a player in this game")
          ) {
            setRefusedGame({
              id: watching.current,
              reason: event.message === GONE[0] ? "not_found" : "is_player",
            });
            watching.current = null;
            break;
          }
          if (joining.current && GONE.includes(event.message)) {
            setRefusedGame({
              id: joining.current,
              reason: event.message === GONE[0] ? "not_found" : "not_player",
            });
            joining.current = null;
            joinedOn.current = null;
            storeGame(null);
            break;
          }
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

  // A new socket has joined nothing yet
  useEffect(() => {
    if (status !== "open") joinedOn.current = null;
  }, [status]);

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
      // Opened from the URL (reload, link): the actions need the game id too
      setGameId(id);
      storeGame(id);
      if (joinedOn.current === id) return;
      joinedOn.current = id;
      joining.current = id;
      setRefusedGame(null);
      send({ type: "join_game", gameId: id });
    },
    [send],
  );

  const spectateGame = useCallback(
    (id: string) => {
      watching.current = id;
      setRefusedGame(null);
      setGameState((state) => (state?.id === id ? state : null));
      setWinnerId(null);
      setUnoCalls({});
      setUnoEvent(null);
      send({ type: "spectate_game", gameId: id });
    },
    [send],
  );

  const leaveSpectate = useCallback(
    (id: string) => {
      watching.current = null;
      send({ type: "leave_spectate", gameId: id });
      // Forget the watched game (not my own game, if I have one)
      setGameState((state) => (state?.id === id ? null : state));
      setWinnerId(null);
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

  const challengeBluff = useCallback(() => {
    if (!gameId) return;
    send({ type: "challenge_bluff", gameId });
  }, [send, gameId]);

  const acceptWildDraw4 = useCallback(() => {
    if (!gameId) return;
    send({ type: "accept_wild_draw4", gameId });
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
    setRefusedGame(null);
    storeGame(null);
    setGameState(null);
    setWinnerId(null);
    setTurnStartedAt(null);
    setUnoCalls({});
    setUnoEvent(null);
    setChatMessages([]);
  }, []);

  const sendChatMessage = useCallback(
    (content: string) => {
      if (!gameId) return;
      send({ type: "chat_message", gameId, content });
    },
    [send, gameId],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<GameContextValue>(
    () => ({
      status,
      room,
      gameId,
      gameState,
      turnStartedAt,
      winnerId,
      unoCalls,
      unoEvent,
      inQueue,
      refusedGame,
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
      spectateGame,
      leaveSpectate,
      playCard,
      drawCard,
      callUno,
      challengeBluff,
      acceptWildDraw4,
      catchUno,
      clearGame,
      chatMessages,
      sendChatMessage,
    }),
    [
      status,
      room,
      gameId,
      gameState,
      turnStartedAt,
      winnerId,
      unoCalls,
      unoEvent,
      inQueue,
      refusedGame,
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
      spectateGame,
      leaveSpectate,
      playCard,
      drawCard,
      callUno,
      challengeBluff,
      acceptWildDraw4,
      catchUno,
      clearGame,
      chatMessages,
      sendChatMessage,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
