import { useState, useEffect, useRef } from "react";
import { API_URL, getWsUrl } from "./api";

type Card = { id: string; color: string; value: string };
type Player = {
  userId: string;
  username: string;
  hand: Card[];
  isCurrentTurn: boolean;
  disconnected: boolean;
};
type GameState = {
  id: string;
  players: Player[];
  currentColor: string;
  topCard: Card;
  direction: number;
  drawPileCount: number;
  ranking: string[];
  winnerId: string | null;
  status: string;
};

export function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [userId, setUserId] = useState<string>("");
  const [gameId, setGameId] = useState<string>("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Login
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const signup = async () => {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUserId(data.user.id);
    }
  };

  const login = async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUserId(data.user.id);
    }
  };

  // Create game
  const createGame = async () => {
    const res = await fetch(`${API_URL}/game/games/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        participants: [
          { id: userId, username },
          { id: opponentId, username: opponentName },
        ],
        mode: "classic",
      }),
    });
    const data = await res.json();
    if (data.gameId) setGameId(data.gameId);
  };

  // WebSocket
  const connectWs = () => {
      const ws = new WebSocket(getWsUrl(token!));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_game", gameId }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "game_updated") setGameState(msg.state);
      if (msg.type === "chat_message")
        setMessages((prev) => [...prev, `${msg.username}: ${msg.content}`]);
      if (msg.type === "game_ended")
        setMessages((prev) => [
          ...prev,
          `🏆 Game ended! Winner: ${msg.winnerId}`,
        ]);
      if (msg.type === "error")
        setMessages((prev) => [...prev, `❌ ${msg.message}`]);
    };
    wsRef.current = ws;
  };

  const playCard = (cardId: string, chosenColor?: string) => {
    wsRef.current?.send(
      JSON.stringify({ type: "play_card", gameId, cardId, chosenColor }),
    );
  };

  const drawCard = () => {
    wsRef.current?.send(JSON.stringify({ type: "draw_card", gameId }));
  };

  const sendChat = () => {
    wsRef.current?.send(
      JSON.stringify({ type: "chat_message", gameId, content: chatInput }),
    );
    setChatInput("");
  };

  // Pas de token = login
  if (!token) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>Login / Signup</h1>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <br />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button onClick={signup}>Signup</button>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  // Pas de game = lobby
  if (!gameState) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>Lobby</h1>
        <p>User ID: {userId}</p>
        <h3>Create Game</h3>
        <input
          placeholder="Opponent ID"
          value={opponentId}
          onChange={(e) => setOpponentId(e.target.value)}
        />
        <br />
        <input
          placeholder="Opponent Username"
          value={opponentName}
          onChange={(e) => setOpponentName(e.target.value)}
        />
        <br />
        <button onClick={createGame}>Create Game</button>
        {gameId && (
          <div>
            <p>Game ID: {gameId}</p>
            <button onClick={connectWs}>Join Game</button>
          </div>
        )}
        <h3>Join Existing Game</h3>
        <input
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
        <br />
        <button onClick={connectWs}>Join</button>
        <br />
        <br />
        <button
          onClick={() => {
            localStorage.removeItem("token");
            setToken(null);
          }}
        >
          Logout
        </button>
      </div>
    );
  }

  // Game
  const me = gameState.players.find((p) => p.userId === userId);
  const opponents = gameState.players.filter((p) => p.userId !== userId);

  const cardStyle = (card: Card) => ({
    padding: "8px 12px",
    margin: "4px",
    border: "2px solid #333",
    borderRadius: "8px",
    backgroundColor: card.color === "wild" ? "#333" : card.color,
    color: ["yellow", "green"].includes(card.color) ? "#333" : "#fff",
    cursor: me?.isCurrentTurn ? "pointer" : "default",
    display: "inline-block",
    fontWeight: "bold" as const,
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>UNO - {gameState.status}</h1>

      {/* Opponents */}
      {opponents.map((o) => (
        <div key={o.userId}>
          <h3>
            {o.username} {o.isCurrentTurn ? "⬅️ playing" : ""} ({o.hand.length}{" "}
            cards)
          </h3>
        </div>
      ))}

      {/* Top card */}
      <div style={{ margin: "20px 0" }}>
        <h3>Top Card (color: {gameState.currentColor})</h3>
        <span style={cardStyle(gameState.topCard)}>
          {gameState.topCard.value}
        </span>
        <span>
          {" "}
          | Draw pile: {gameState.drawPileCount} | Direction:{" "}
          {gameState.direction === 1 ? "→" : "←"}
        </span>
      </div>

      {/* My hand */}
      <div>
        <h3>
          My hand ({me?.hand.length} cards){" "}
          {me?.isCurrentTurn ? "- YOUR TURN" : ""}
        </h3>
        {me?.hand.map((card) => (
          <span
            key={card.id}
            style={cardStyle(card)}
            onClick={() => {
              if (!me.isCurrentTurn) return;
              if (card.color === "wild") {
                const color = prompt("Choose color: red, yellow, green, blue");
                if (color) playCard(card.id, color);
              } else {
                playCard(card.id);
              }
            }}
          >
            {card.value}
          </span>
        ))}
      </div>

      {/* Draw */}
      <div style={{ margin: "20px 0" }}>
        <button onClick={drawCard} disabled={!me?.isCurrentTurn}>
          Draw Card
        </button>
      </div>

      {/* Chat */}
      <div
        style={{
          marginTop: "20px",
          borderTop: "1px solid #ccc",
          paddingTop: "10px",
        }}
      >
        <h3>Chat</h3>
        <div
          style={{
            height: "100px",
            overflow: "auto",
            border: "1px solid #eee",
            padding: "8px",
          }}
        >
          {messages.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendChat()}
        />
        <button onClick={sendChat}>Send</button>
      </div>

      {/* Winner */}
      {gameState.winnerId && (
        <h2>
          🏆 Winner:{" "}
          {
            gameState.players.find((p) => p.userId === gameState.winnerId)
              ?.username
          }
        </h2>
      )}
    </div>
  );
}
