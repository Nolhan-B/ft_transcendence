import process from "node:process";
import WebSocket from "ws";

// Accepte le certificat SSL auto-signé pour fetch et WebSocket
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const API = process.env.API_URL || "https://localhost:8443/api";
const WS_URL = process.env.WS_URL || "wss://localhost:8443/api/game/ws";

let passed = 0;
let failed = 0;
const activeSockets: WebSocket[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}
function log(msg: string) {
  console.log(`  ${msg}`);
}

async function post(path: string, body: object, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON on POST ${path} (HTTP ${res.status}): ${text.slice(0, 120)}`,
    );
  }
}

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON on GET ${path} (HTTP ${res.status}): ${text.slice(0, 120)}`,
    );
  }
}

function createClient(token: string): Promise<{
  ws: WebSocket;
  waitFor: (type: string, timeout?: number) => Promise<any>;
  send: (msg: object) => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`, {
      rejectUnauthorized: false,
      handshakeTimeout: 5000,
    });
    activeSockets.push(ws);

    const pending: any[] = [];
    const waiters: { type: string; resolve: (msg: any) => void }[] = [];

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      const i = waiters.findIndex((w) => w.type === msg.type);
      if (i !== -1) {
        waiters[i].resolve(msg);
        waiters.splice(i, 1);
      } else {
        pending.push(msg);
      }
    });

    ws.on("open", () =>
      resolve({
        ws,
        send: (msg: object) => ws.send(JSON.stringify(msg)),
        waitFor: (type: string, timeout = 5000) => {
          const i = pending.findIndex((m) => m.type === type);
          if (i !== -1) {
            const m = pending[i];
            pending.splice(i, 1);
            return Promise.resolve(m);
          }
          return new Promise((res, rej) => {
            const t = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.resolve === res);
              if (idx !== -1) waiters.splice(idx, 1);
              rej(new Error(`Timeout waiting for ${type}`));
            }, timeout);
            waiters.push({
              type,
              resolve: (msg) => {
                clearTimeout(t);
                res(msg);
              },
            });
          });
        },
      }),
    );

    ws.on("error", reject);
  });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: unknown) {
    console.log(`❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  } finally {
    while (activeSockets.length > 0) {
      const ws = activeSockets.pop();
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING)
      ) {
        ws.close();
      }
    }
  }
}

// Setup
const alice = {
  email: `alice-${Date.now()}@test.com`,
  username: `alice${Date.now()}`,
  password: "test1234",
};
const bob = {
  email: `bob-${Date.now()}@test.com`,
  username: `bob${Date.now()}`,
  password: "test1234",
};
const charlie = {
  email: `charlie-${Date.now()}@test.com`,
  username: `charlie${Date.now()}`,
  password: "test1234",
};
let aliceToken = "",
  bobToken = "",
  charlieToken = "";

await test("signup users", async () => {
  const a = await post("/auth/signup", alice);
  aliceToken = a.token;
  assert(!!aliceToken, "Alice token");
  const b = await post("/auth/signup", bob);
  bobToken = b.token;
  assert(!!bobToken, "Bob token");
  const c = await post("/auth/signup", charlie);
  charlieToken = c.token;
  assert(!!charlieToken, "Charlie token");
  log("All users created");
});

// ============ HTTP ROUTES ============

await test("POST /games/rooms creates a room", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Test Room", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  assert(res.roomCode, "Should return roomCode");
  assert(res.roomCode.length === 6, "Code should be 6 chars");
  log(`Room code: ${res.roomCode}`);
});

await test("POST /games/rooms rejects invalid maxPlayers", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Bad", mode: "classic", maxPlayers: 10 },
    aliceToken,
  );
  assert(res.error, "Should return error");
  log("maxPlayers validation works");
});

await test("GET /games/rooms lists rooms", async () => {
  await post(
    "/game/games/rooms",
    { name: "Visible Room", mode: "classic", maxPlayers: 3 },
    aliceToken,
  );
  const rooms = await get("/game/games/rooms");
  assert(Array.isArray(rooms), "Should return array");
  assert(rooms.length > 0, "Should have at least one room");
  const room = rooms.find((r: any) => r.name === "Visible Room");
  assert(room, "Should find the created room");
  assert(room.hasPassword === false, "Should not have password");
  assert(!room.password, "Password should not be exposed");
  log(`Listed ${rooms.length} rooms`);
});

await test("GET /games/rooms hides password", async () => {
  await post(
    "/game/games/rooms",
    {
      name: "Secret Room",
      mode: "classic",
      maxPlayers: 2,
      password: "secret123",
    },
    aliceToken,
  );
  const rooms = await get("/game/games/rooms");
  const room = rooms.find((r: any) => r.name === "Secret Room");
  assert(room, "Should find secret room");
  assert(room.hasPassword === true, "Should have password flag");
  assert(!room.password, "Actual password should not be exposed");
  log("Password hidden correctly");
});

// ============ WEBSOCKET - JOIN ROOM ============

await test("join_room via WebSocket", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "WS Room", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  const update = await bobClient.waitFor("room_updated");
  assert(update.room.code === res.roomCode, "Should receive room update");
  assert(update.room.players.length === 2, "Should have 2 players");
  log("Bob joined via WebSocket");
  bobClient.ws.close();
});

await test("join_room broadcasts to existing players", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Broadcast Room", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  await aliceClient.waitFor("connected");
  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");

  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });

  const aliceUpdate = await aliceClient.waitFor("room_updated");
  assert(aliceUpdate.room.players.length === 2, "Alice should see 2 players");
  log("Broadcast to existing players works");
  aliceClient.ws.close();
  bobClient.ws.close();
});

await test("join_room with wrong password fails", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Locked", mode: "classic", maxPlayers: 2, password: "correct" },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({
    type: "join_room",
    roomCode: res.roomCode,
    password: "wrong",
  });
  const error = await bobClient.waitFor("error");
  assert(
    error.message === "Password is incorrect",
    "Should get password error",
  );
  log("Wrong password rejected");
  bobClient.ws.close();
});

await test("join_room with correct password works", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Locked OK", mode: "classic", maxPlayers: 2, password: "correct" },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({
    type: "join_room",
    roomCode: res.roomCode,
    password: "correct",
  });
  const update = await bobClient.waitFor("room_updated");
  assert(update.room.players.length === 2, "Should join with correct password");
  log("Correct password accepted");
  bobClient.ws.close();
});

await test("join_room full room fails", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Full", mode: "classic", maxPlayers: 2 },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await bobClient.waitFor("room_updated");

  const charlieClient = await createClient(charlieToken);
  await charlieClient.waitFor("connected");
  charlieClient.send({ type: "join_room", roomCode: res.roomCode });
  const error = await charlieClient.waitFor("error");
  assert(error.message.includes("capacity"), "Should get full room error");
  log("Full room rejected");
  bobClient.ws.close();
  charlieClient.ws.close();
});

// ============ WEBSOCKET - LEAVE ROOM ============

await test("leave_room removes player and broadcasts", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Leave Test", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  bobClient.send({ type: "leave_room", roomCode: res.roomCode });
  const update = await aliceClient.waitFor("room_updated");
  assert(update.room.players.length === 1, "Should have 1 player after leave");
  log("Leave room works");
  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============ WEBSOCKET - UPDATE ROOM ============

await test("update_room changes settings", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Settings Test", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  aliceClient.send({
    type: "update_room",
    roomCode: res.roomCode,
    settings: {
      stacking: "all",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  });
  const update = await bobClient.waitFor("room_updated");
  assert(update.room.settings.stacking === "all", "Stacking should be all");
  assert(
    update.room.settings.sevenZeroRule === true,
    "SevenZero should be true",
  );
  log("Settings updated and broadcast");
  aliceClient.ws.close();
  bobClient.ws.close();
});

await test("update_room rejects non-leader", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Leader Only", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await bobClient.waitFor("room_updated");

  bobClient.send({
    type: "update_room",
    roomCode: res.roomCode,
    settings: {
      stacking: "all",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  });
  const rooms = await get("/game/games/rooms");
  const room = rooms.find((r: any) => r.code === res.roomCode);
  assert(room.settings.stacking === "none", "Settings should not change");
  log("Non-leader rejected");
  bobClient.ws.close();
});

// ============ WEBSOCKET - START GAME ============

await test("start_game creates game and broadcasts", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Start Test", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  aliceClient.send({ type: "start_game", roomCode: res.roomCode });
  const aliceStart = await aliceClient.waitFor("game_started");
  const bobStart = await bobClient.waitFor("game_started");
  assert(aliceStart.gameId, "Alice should receive gameId");
  assert(bobStart.gameId === aliceStart.gameId, "Both should get same gameId");
  log(`Game started: ${aliceStart.gameId}`);

  // Room should be gone
  const rooms = await get("/game/games/rooms");
  const room = rooms.find((r: any) => r.code === res.roomCode);
  assert(!room, "Room should be deleted after start");
  log("Room cleaned up");

  aliceClient.ws.close();
  bobClient.ws.close();
});

await test("start_game rejects non-leader", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "No Start", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await bobClient.waitFor("room_updated");

  bobClient.send({ type: "start_game", roomCode: res.roomCode });
  const error = await bobClient.waitFor("error");
  assert(
    error.message === "Only the leader can start",
    "Should reject non-leader",
  );
  log("Non-leader start rejected");
  bobClient.ws.close();
});

await test("start_game rejects with less than 2 players", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Solo", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  await aliceClient.waitFor("connected");
  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");

  aliceClient.send({ type: "start_game", roomCode: res.roomCode });
  const error = await aliceClient.waitFor("error");
  assert(
    error.message === "Need at least 2 players",
    "Should reject solo start",
  );
  log("Solo start rejected");
  aliceClient.ws.close();
});

// ============ EDGE CASES ============

await test("leader leaves, new leader is assigned", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Leader Leave", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  aliceClient.send({ type: "leave_room", roomCode: res.roomCode });
  const update = await bobClient.waitFor("room_updated");
  assert(update.room.players.length === 1, "Should have 1 player");
  assert(update.room.leaderId !== undefined, "Should have a leader");
  log(`New leader assigned`);
  aliceClient.ws.close();
  bobClient.ws.close();
});

await test("last player leaves, room is deleted", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Delete Me", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  await aliceClient.waitFor("connected");
  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");

  aliceClient.send({ type: "leave_room", roomCode: res.roomCode });
  await new Promise((r) => setTimeout(r, 200));

  const rooms = await get("/game/games/rooms");
  const room = rooms.find((r: any) => r.code === res.roomCode);
  assert(!room, "Room should be deleted");
  log("Room deleted when empty");
  aliceClient.ws.close();
});

await test("join non-existent room returns error", async () => {
  const client = await createClient(aliceToken);
  await client.waitFor("connected");
  client.send({ type: "join_room", roomCode: "ZZZZZZ" });
  const error = await client.waitFor("error");
  assert(error.message === "Room not found", "Should get not found error");
  log("Non-existent room rejected");
  client.ws.close();
});

await test("WebSocket disconnect removes player from room", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Disconnect Test", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  bobClient.ws.close();
  await new Promise((r) => setTimeout(r, 500));

  const rooms = await get("/game/games/rooms");
  const room = rooms.find((r: any) => r.code === res.roomCode);
  assert(room, "Room should still exist");
  assert(room.players.length === 1, "Should have 1 player after disconnect");
  log("Disconnect removed player from room");
  aliceClient.ws.close();
});

await test("after start_game, game is playable", async () => {
  const res = await post(
    "/game/games/rooms",
    { name: "Playable", mode: "classic", maxPlayers: 4 },
    aliceToken,
  );
  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  bobClient.send({ type: "join_room", roomCode: res.roomCode });
  await aliceClient.waitFor("room_updated");
  await bobClient.waitFor("room_updated");

  aliceClient.send({ type: "start_game", roomCode: res.roomCode });
  const aliceStart = await aliceClient.waitFor("game_started");
  await bobClient.waitFor("game_started");
  const gameId = aliceStart.gameId;

  // Both join the game
  aliceClient.send({ type: "join_game", gameId });
  bobClient.send({ type: "join_game", gameId });

  const aliceState = (await aliceClient.waitFor("game_updated")).state;
  const bobState = (await bobClient.waitFor("game_updated")).state;

  assert(aliceState.status === "in_progress", "Game should be in progress");
  assert(aliceState.players.length === 2, "Should have 2 players");
  assert(bobState.id === gameId, "Bob should see the same game");

  // Identify whose turn it is by checking Alice's own player entry (the one with visible cards)
  const aliceMe = aliceState.players.find((p: any) =>
    p.hand.some((c: any) => c.id !== ""),
  );
  const isAliceTurn = Boolean(aliceMe?.isCurrentTurn);
  const currentClient = isAliceTurn ? aliceClient : bobClient;
  const currentState = isAliceTurn ? aliceState : bobState;
  const me = currentState.players.find((p: any) =>
    p.hand.some((c: any) => c.id !== ""),
  );

  const playable = me.hand.find((c: any) => {
    if (c.color === "wild") return true;
    if (c.color === currentState.currentColor) return true;
    if (c.value === currentState.topCard.value) return true;
    return false;
  });

  if (playable) {
    const msg: any = { type: "play_card", gameId, cardId: playable.id };
    if (playable.color === "wild") msg.chosenColor = "red";
    currentClient.send(msg);
  } else {
    currentClient.send({ type: "draw_card", gameId });
  }

  const update = await aliceClient.waitFor("game_updated");
  assert(update.state, "Should receive game update after play");
  log("Game is fully playable after room start");

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============ RESULTS ============

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
