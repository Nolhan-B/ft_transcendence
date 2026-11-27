import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  CardColor,
  ChatMessageEvent,
  CreateRoomPayload,
  GameSettings,
  GameState,
  PlayerLeftReason,
  RoomInfo,
  ServerEvent,
} from "shared";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { GameContext } from "./GameContext";
import type { GameContextValue, RefusedGame, UnoEvent } from "./GameContext";
import { useAuth } from "../hooks/auth/useAuth";

// The server closes the socket after these refusals: retrying is useless.
// Several tabs are fine, each one has its own socket.
const FATAL = ["Unauthorized", "Invalid token"];

// The game in progress, kept in the browser: after a reload the player can
// go back to it (the server does not say which game we are in)
const STORED_GAME = "sns.currentGame";
// Answers to join_game for a game that no longer accepts us
const GONE = ["Game not found", "You are not part of this game"];

// The server sends the time left when it sends the state: the end of the turn
// is counted from now, on this browser's clock (no clock offset with the server)
function endOfTurn(state: GameState): number | null {
  return state.turnTimeLeftMs === null
    ? null
    : Date.now() + state.turnTimeLeftMs;
}

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
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [inQueue, setInQueue] = useState(false);
  const [unoCalls, setUnoCalls] = useState<Record<string, number>>({});
  const [unoEvent, setUnoEvent] = useState<UnoEvent | null>(null);
  const unoEventId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageEvent[]>([]);
  const [refusedGame, setRefusedGame] = useState<RefusedGame | null>(null);
  const [leftReasons, setLeftReasons] = useState<
    Record<string, PlayerLeftReason>
  >({});
  // Game asked with join_game whose first state has not arrived yet: a
  // refusal now is about it (not about an action in a game in progress)
  const joining = useRef<string | null>(null);
  // Game asked with spectate_game, until its first state arrives
  const watching = useRef<string | null>(null);
  // The game I play, and the game I watch as a spectator. Only the state of
  // the followed game is shown (the watched one first): the socket may still
  // get the updates of another game (an old game I was removed from, my own
  // game while I watch another), and showing them made the screen jump from
  // one game to the other.
  const myGame = useRef<string | null>(null);
  const spectated = useRef<string | null>(null);
  // The game I really play right now: I am one of its players, not removed,
  // and it is in progress. When I leave another game (back to the lobby
  // after being removed, end of spectating), the provider follows this one
  // again, so "Back to game" and the reconnection keep working.
  const activeGame = useRef<string | null>(null);

  // Game joined on the current socket: joining twice would register the
  // socket twice on the server, and every event would arrive twice
  const joinedOn = useRef<string | null>(null);
  // Stored game we are trying to join back after a reload
  const restoring = useRef<string | null>(null);

  const { refresh, user } = useAuth();
  // My id, for the message handler (it is not rebuilt when the user changes)
  const myId = useRef<string | undefined>(user?.id);
  myId.current = user?.id;

  const { status, send } = useWebSocket({
    path: "/api/game/ws",
    isFatal: (message) => {
      const event = message as ServerEvent;
      return event.type === "error" && FATAL.includes(event.message);
    },
    onMessage: (message) => {
      // Not part of ServerEvent: sent by the server once it accepts the socket
      if ((message as { type?: string }).type === "connected") {
        // Back from a reload: join the stored game again, so that we stay in
        // it (unless the game page already did)
        const stored = storedGame();
        if (stored && joinedOn.current === null) {
          restoring.current = stored;
          joinedOn.current = stored;
          myGame.current = stored;
          send({ type: "join_game", gameId: stored });
        }
        return;
      }
      const event = message as ServerEvent;
      switch (event.type) {
        case "room_updated":
          setRoom(event.room);
          break;
        case "room_left":
          // Left from another tab, or moved to another room
          setRoom((room) => (room?.code === event.roomCode ? null : room));
          break;
        case "game_started":
          setGameId(event.gameId);
          storeGame(event.gameId);
          myGame.current = event.gameId;
          // New game: forget the previous one
          setGameState(null);
          setWinnerId(null);
          setUnoCalls({});
          setUnoEvent(null);
          setChatMessages([]);
          setLeftReasons({});
          // The server removes the room when the game starts
          setRoom(null);
          break;
        case "player_left":
          setLeftReasons((reasons) => ({
            ...reasons,
            [event.userId]: event.reason,
          }));
          break;
        case "player_joined":
          // Back in the game: forget why the player had left
          setLeftReasons((reasons) => {
            if (!(event.userId in reasons)) return reasons;
            const rest = { ...reasons };
            delete rest[event.userId];
            return rest;
          });
          break;
        case "spectate_started":
          if (spectated.current !== event.state.id) break;
          if (watching.current === event.state.id) watching.current = null;
          setGameState(event.state);
          setTurnStartedAt(Date.now());
          setTurnEndsAt(endOfTurn(event.state));
          break;
        case "game_updated": {
          // Keep track of the game I really play, even when it is not shown
          const me = event.state.players.find((p) => p.userId === myId.current);
          if (me && !me.disconnected && event.state.status === "in_progress")
            activeGame.current = event.state.id;
          else if (activeGame.current === event.state.id)
            activeGame.current = null;
          // Not the game on screen: ignore it
          if (event.state.id !== (spectated.current ?? myGame.current)) break;
          if (joining.current === event.state.id) joining.current = null;
          if (restoring.current === event.state.id) {
            restoring.current = null;
            setGameId(event.state.id);
          }
          setGameState(event.state);
          setTurnStartedAt(Date.now());
          setTurnEndsAt(endOfTurn(event.state));
          break;
        }
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
          myGame.current = event.gameId;
          setGameState(null);
          setWinnerId(null);
          setUnoCalls({});
          setUnoEvent(null);
          setChatMessages([]);
          setLeftReasons({});
          break;
        case "chat_message":
          setChatMessages((prev) => [...prev, event]);
          break;
        case "elo_updated":
          void refresh();
          break;
        case "error":
          // "Cancel" on a queue the server already left (connection dropped
          // meanwhile): out of the queue is what the user wanted, no error
          if (event.message === "Not in queue") {
            setInQueue(false);
            break;
          }
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
          setError(event.message);
          break;
      }
    },
  });

  // A new socket has joined nothing yet. The server also takes us out of our
  // room when the socket closes (and deletes it if we were its only human):
  // keeping it here would show a dead room and send its code in invites
  // ("Room not found"). Same for the ranked queue: the server removed us, so
  // "Cancel" answered "Not in queue"; the card offers to search again.
  useEffect(() => {
    if (status === "open") return;
    joinedOn.current = null;
    setRoom(null);
    setInQueue(false);
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

  const inviteToRoom = useCallback(
    (roomCode: string, userId: string) => {
      send({ type: "invite_to_room", roomCode, userId });
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
      myGame.current = id;
      if (joinedOn.current === id) return;
      joinedOn.current = id;
      joining.current = id;
      setRefusedGame(null);
      send({ type: "join_game", gameId: id });
    },
    [send],
  );

  // Follow again the game I really play, if any (not `leaving`): its state
  // comes back with join_game, the server also subscribes the socket again
  const followActiveGame = useCallback(
    (leaving: string | null) => {
      const id = activeGame.current;
      if (!id || id === leaving) return;
      myGame.current = id;
      joinedOn.current = id;
      setGameId(id);
      storeGame(id);
      send({ type: "join_game", gameId: id });
    },
    [send],
  );

  const spectateGame = useCallback(
    (id: string) => {
      watching.current = id;
      spectated.current = id;
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
      if (spectated.current === id) spectated.current = null;
      send({ type: "leave_spectate", gameId: id });
      // Forget the watched game (not my own game, if I have one)
      setGameState((state) => (state?.id === id ? null : state));
      setWinnerId(null);
      followActiveGame(id);
    },
    [send, followActiveGame],
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
    const leaving = myGame.current;
    myGame.current = null;
    joinedOn.current = null;
    setGameId(null);
    setRefusedGame(null);
    storeGame(null);
    setGameState(null);
    setWinnerId(null);
    setTurnStartedAt(null);
    setTurnEndsAt(null);
    setUnoCalls({});
    setUnoEvent(null);
    setChatMessages([]);
    setLeftReasons({});
    // Leaving a game I was removed from: back to the one I still play
    followActiveGame(leaving);
  }, [followActiveGame]);

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
      turnEndsAt,
      winnerId,
      unoCalls,
      unoEvent,
      inQueue,
      refusedGame,
      leftReasons,
      error,
      clearError,
      createRoom,
      joinRoom,
      inviteToRoom,
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
      turnEndsAt,
      winnerId,
      unoCalls,
      unoEvent,
      inQueue,
      refusedGame,
      leftReasons,
      error,
      clearError,
      createRoom,
      joinRoom,
      inviteToRoom,
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
