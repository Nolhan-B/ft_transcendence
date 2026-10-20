import WebSocket from "ws";

const API = "http://localhost:8080/api";
const WS_URL = "ws://localhost:8080/api/game/ws";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function post(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

function connectWs(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, type: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    const handler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

function send(ws: WebSocket, msg: object) {
  ws.send(JSON.stringify(msg));
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${name}: ${msg}`);
    failed++;
  }
}

// ============================================================
// TESTS
// ============================================================

const alice = { email: `alice-${Date.now()}@test.com`, username: `alice${Date.now()}`, password: "test1234" };
const bob = { email: `bob-${Date.now()}@test.com`, username: `bob${Date.now()}`, password: "test1234" };

let aliceToken = "";
let bobToken = "";
let aliceId = "";
let bobId = "";
let gameId = "";

await test("signup alice", async () => {
  const res = await post("/auth/signup", alice);
  assert(res.token, "Alice should get a token");
  aliceToken = res.token;
  aliceId = res.user.id;
  log(`Alice ID: ${aliceId}`);
});

await test("signup bob", async () => {
  const res = await post("/auth/signup", bob);
  assert(res.token, "Bob should get a token");
  bobToken = res.token;
  bobId = res.user.id;
  log(`Bob ID: ${bobId}`);
});

await test("create game", async () => {
  const res = await post("/game/games/create", {
    participants: [
      { id: aliceId, username: alice.username },
      { id: bobId, username: bob.username },
    ],
    mode: "classic",
  }, aliceToken);
  assert(res.gameId, "Should return a gameId");
  gameId = res.gameId;
  log(`Game ID: ${gameId}`);
});

await test("alice joins via WebSocket", async () => {
  const ws = await connectWs(aliceToken);
  const connected = await waitForMessage(ws, "connected");
  assert(connected.type === "connected", "Should receive connected");

  send(ws, { type: "join_game", gameId });
  const state = await waitForMessage(ws, "game_updated");
  assert(state.state.id === gameId, "Should receive game state");
  assert(state.state.players.length === 2, "Should have 2 players");
  log(`Alice sees ${state.state.players[0].hand.length} cards`);
  ws.close();
});

await test("bob joins via WebSocket", async () => {
  const ws = await connectWs(bobToken);
  await waitForMessage(ws, "connected");

  send(ws, { type: "join_game", gameId });
  const state = await waitForMessage(ws, "game_updated");
  assert(state.state.id === gameId, "Should receive game state");

  // Bob's hand should be visible, Alice's hidden
  const bobPlayer = state.state.players.find((p: any) => p.userId === bobId);
  const alicePlayer = state.state.players.find((p: any) => p.userId === aliceId);
  assert(bobPlayer.hand.every((c: any) => c.id !== ""), "Bob should see his own cards");
  assert(alicePlayer.hand.every((c: any) => c.id === ""), "Alice cards should be hidden");
  log("State filtering works correctly");
  ws.close();
});

await test("play a full game", async () => {
  const aliceWs = await connectWs(aliceToken);
  const bobWs = await connectWs(bobToken);

  await waitForMessage(aliceWs, "connected");
  await waitForMessage(bobWs, "connected");

  send(aliceWs, { type: "join_game", gameId });
  send(bobWs, { type: "join_game", gameId });

  let aliceState = (await waitForMessage(aliceWs, "game_updated")).state;
  let bobState = (await waitForMessage(bobWs, "game_updated")).state;

  let turns = 0;
  const maxTurns = 200;

  while (aliceState.status === "in_progress" && turns < maxTurns) {
    turns++;
    const isAliceTurn = aliceState.players.find((p: any) => p.userId === aliceId)?.isCurrentTurn;
    const currentWs = isAliceTurn ? aliceWs : bobWs;
    const currentId = isAliceTurn ? aliceId : bobId;
    const currentState = isAliceTurn ? aliceState : bobState;

    const me = currentState.players.find((p: any) => p.userId === currentId);
    const playableCard = me.hand.find((c: any) => {
      if (c.color === "wild") return true;
      if (c.color === currentState.currentColor) return true;
      if (c.value === currentState.topCard.value) return true;
      return false;
    });

    if (playableCard) {
      const msg: any = { type: "play_card", gameId, cardId: playableCard.id };
      if (playableCard.color === "wild") {
        const colors = ["red", "yellow", "green", "blue"];
        msg.chosenColor = colors[Math.floor(Math.random() * 4)];
      }
      send(currentWs, msg);
    } else {
      send(currentWs, { type: "draw_card", gameId });
    }

    // Wait for both to get the update
    aliceState = (await waitForMessage(aliceWs, "game_updated")).state;
    bobState = (await waitForMessage(bobWs, "game_updated")).state;
  }

  assert(aliceState.status === "finished", `Game should be finished, got ${aliceState.status}`);
  assert(aliceState.winnerId !== null, "Should have a winner");
  const winner = aliceState.winnerId === aliceId ? "Alice" : "Bob";
  log(`Game finished in ${turns} turns. Winner: ${winner}`);

  // Check game_ended event
  const ended = await waitForMessage(aliceWs, "game_ended", 2000).catch(() => null);
  if (ended) log("game_ended event received");

  aliceWs.close();
  bobWs.close();
});

await test("chat message works", async () => {
  // Create a new game for chat test
  const res = await post("/game/games/create", {
    participants: [
      { id: aliceId, username: alice.username },
      { id: bobId, username: bob.username },
    ],
    mode: "classic",
  }, aliceToken);
  const chatGameId = res.gameId;

  const aliceWs = await connectWs(aliceToken);
  const bobWs = await connectWs(bobToken);

  await waitForMessage(aliceWs, "connected");
  await waitForMessage(bobWs, "connected");

  send(aliceWs, { type: "join_game", gameId: chatGameId });
  send(bobWs, { type: "join_game", gameId: chatGameId });

  await waitForMessage(aliceWs, "game_updated");
  await waitForMessage(bobWs, "game_updated");

  // Alice sends a chat message
  send(aliceWs, { type: "chat_message", gameId: chatGameId, content: "hello bob!" });

  // Bob should receive it
  const chatMsg = await waitForMessage(bobWs, "chat_message");
  assert(chatMsg.content === "hello bob!", "Bob should receive the chat message");
  assert(chatMsg.userId === aliceId, "Message should be from Alice");
  log("Chat message received by Bob");

  aliceWs.close();
  bobWs.close();
});

await test("invalid move returns error", async () => {
  const res = await post("/game/games/create", {
    participants: [
      { id: aliceId, username: alice.username },
      { id: bobId, username: bob.username },
    ],
    mode: "classic",
  }, aliceToken);

  const ws = await connectWs(bobToken);
  await waitForMessage(ws, "connected");

  send(ws, { type: "join_game", gameId: res.gameId });
  await waitForMessage(ws, "game_updated");

  // Bob tries to play but it's Alice's turn
  send(ws, { type: "play_card", gameId: res.gameId, cardId: "fake-card" });
  const error = await waitForMessage(ws, "error");
  assert(error.message === "Invalid move", "Should get invalid move error");
  log("Error message received correctly");

  ws.close();
});

await test("disconnect broadcasts player_left", async () => {
  const res = await post("/game/games/create", {
    participants: [
      { id: aliceId, username: alice.username },
      { id: bobId, username: bob.username },
    ],
    mode: "classic",
  }, aliceToken);

  const aliceWs = await connectWs(aliceToken);
  const bobWs = await connectWs(bobToken);

  await waitForMessage(aliceWs, "connected");
  await waitForMessage(bobWs, "connected");

  send(aliceWs, { type: "join_game", gameId: res.gameId });
  send(bobWs, { type: "join_game", gameId: res.gameId });

  await waitForMessage(aliceWs, "game_updated");
  await waitForMessage(bobWs, "game_updated");

  // Bob disconnects
  bobWs.close();

  // Alice should receive player_left
  const left = await waitForMessage(aliceWs, "player_left", 3000);
  assert(left.userId === bobId, "Should receive player_left for Bob");
  log("player_left received by Alice");

  aliceWs.close();
});

// ============================================================
// RESULTS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);