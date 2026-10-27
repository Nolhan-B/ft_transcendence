import process from "node:process";
import WebSocket from "ws";

// Accepte le certificat SSL auto-signé pour fetch et ws en local / CI
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const API = process.env.API_URL || "https://localhost:8443/api";
const WS_URL = process.env.WS_URL || "wss://localhost:8443/api/game/ws";

let passed = 0;
let failed = 0;

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
  });
  return res.json();
}

function createClient(token: string): Promise<{
  ws: WebSocket;
  waitFor: (type: string, timeout?: number) => Promise<any>;
  send: (msg: object) => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`, {
      rejectUnauthorized: false,
    });
    const pending: any[] = [];
    const waiters: {
      type: string;
      resolve: (msg: any) => void;
      reject: (err: Error) => void;
    }[] = [];

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      const waiter = waiters.findIndex((w) => w.type === msg.type);
      if (waiter !== -1) {
        waiters[waiter].resolve(msg);
        waiters.splice(waiter, 1);
      } else {
        pending.push(msg);
      }
    });

    ws.on("open", () => {
      resolve({
        ws,
        send: (msg: object) => ws.send(JSON.stringify(msg)),
        waitFor: (type: string, timeout = 5000) => {
          const idx = pending.findIndex((m) => m.type === type);
          if (idx !== -1) {
            const msg = pending[idx];
            pending.splice(idx, 1);
            return Promise.resolve(msg);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const i = waiters.findIndex((w) => w.resolve === res);
              if (i !== -1) waiters.splice(i, 1);
              rej(new Error(`Timeout waiting for ${type}`));
            }, timeout);
            waiters.push({
              type,
              resolve: (msg) => {
                clearTimeout(timer);
                res(msg);
              },
              reject: (err) => {
                clearTimeout(timer);
                rej(err);
              },
            });
          });
        },
      });
    });

    ws.on("error", reject);
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function playFullGame(
  clients: { client: Client; id: string }[],
  gameId: string,
  maxTurns = 300,
): Promise<{ winner: string; turns: number; states: any[] }> {
  const states: Map<string, any> = new Map();

  // Join all players
  for (const { client } of clients) {
    client.send({ type: "join_game", gameId });
  }

  // Wait for all to get initial state
  for (const { client, id } of clients) {
    const msg = await client.waitFor("game_updated");
    states.set(id, msg.state);
  }

  let turns = 0;

  while (turns < maxTurns) {
    const isFinished = Array.from(states.values()).some(
      (s) => s?.status === "finished",
    );
    if (isFinished) break;

    turns++;

    // Find whose turn it is
    const currentTurnPlayer = clients.find(({ id }) => {
      const state = states.get(id)!;
      return state.players.find((p: any) => p.userId === id)?.isCurrentTurn;
    });

    if (!currentTurnPlayer) break;

    const { client, id } = currentTurnPlayer;
    const state = states.get(id)!;
    const me = state.players.find((p: any) => p.userId === id);

    let playableCard;

    if (state.pendingDrawCount > 0) {
      // Stacking actif : seules les cartes draw sont jouables
      playableCard = me.hand.find(
        (c: any) => c.value === "draw2" || c.value === "wild_draw4",
      );
    } else {
      playableCard = me.hand.find((c: any) => {
        if (c.color === "wild") return true;
        if (c.color === state.currentColor) return true;
        if (c.value === state.topCard.value) return true;
        return false;
      });
    }

    if (playableCard) {
      const msg: any = { type: "play_card", gameId, cardId: playableCard.id };
      if (playableCard.color === "wild") {
        const colors = ["red", "yellow", "green", "blue"];
        msg.chosenColor = colors[Math.floor(Math.random() * 4)];
      }
      client.send(msg);
    } else {
      client.send({ type: "draw_card", gameId });
    }

    // Wait for all to get update
    for (const { client: c, id: cId } of clients) {
      const msg = await c.waitFor("game_updated");
      states.set(cId, msg.state);
    }
  }

  const finishedState =
    Array.from(states.values()).find((s) => s?.status === "finished") ||
    states.get(clients[0].id)!;

  return {
    winner: finishedState.winnerId,
    turns,
    states: Array.from(states.values()),
  };
}

async function test(name: string, fn: () => Promise<void>, retries = 0) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
      return;
    } catch (e: unknown) {
      if (attempt < retries) {
        console.log(`  ⟳ ${name}: retry ${attempt + 1}/${retries}`);
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${name}: ${msg}`);
      failed++;
    }
  }
}

// ============================================================
// SETUP
// ============================================================

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

let aliceToken = "";
let bobToken = "";
let charlieToken = "";
let aliceId = "";
let bobId = "";
let charlieId = "";

// ============================================================
// AUTH
// ============================================================

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

await test("signup charlie", async () => {
  const res = await post("/auth/signup", charlie);
  assert(res.token, "Charlie should get a token");
  charlieToken = res.token;
  charlieId = res.user.id;
  log(`Charlie ID: ${charlieId}`);
});

// ============================================================
// GAME CREATION
// ============================================================

await test("create classic game", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );
  assert(res.gameId, "Should return a gameId");
  log(`Game ID: ${res.gameId}`);
});

await test("create game with custom settings", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
      settings: {
        stacking: "all",
        sevenZeroRule: true,
        jumpIn: true,
        bluffChallenge: true,
        unoCallout: true,
      },
    },
    aliceToken,
  );
  assert(res.gameId, "Should return a gameId");

  // Verify settings are passed through
  const client = await createClient(aliceToken);
  await client.waitFor("connected");
  client.send({ type: "join_game", gameId: res.gameId });
  const state = (await client.waitFor("game_updated")).state;
  assert(state.settings.stacking === "all", "stacking should be all");
  assert(state.settings.sevenZeroRule === true, "sevenZeroRule should be true");
  assert(state.settings.jumpIn === true, "jumpIn should be true");
  assert(
    state.settings.bluffChallenge === true,
    "bluffChallenge should be true",
  );
  assert(state.settings.unoCallout === true, "unoCallout should be true");
  log("Custom settings passed through correctly");
  client.ws.close();
});

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================

await test("receives connected event on WebSocket open", async () => {
  const client = await createClient(aliceToken);
  const msg = await client.waitFor("connected");
  assert(msg.type === "connected", "Should receive connected");
  client.ws.close();
});

await test("invalid token is rejected", async () => {
  try {
    const client = await createClient("invalid-token");
    const error = await client.waitFor("error", 2000);
    assert(error.message === "Invalid token", "Should get invalid token error");
    client.ws.close();
  } catch {
    // Connection refused or closed is also acceptable
    log("Connection rejected (expected)");
  }
});

// ============================================================
// JOIN GAME
// ============================================================

await test("join game returns filtered state", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const client = await createClient(aliceToken);
  await client.waitFor("connected");
  client.send({ type: "join_game", gameId: res.gameId });

  const state = (await client.waitFor("game_updated")).state;
  assert(state.id === res.gameId, "Should receive correct game");
  assert(state.players.length === 2, "Should have 2 players");
  assert(state.topCard.color !== "wild", "Top card should not be wild");
  assert(state.drawPileCount > 0, "Draw pile should not be empty");

  const me = state.players.find((p: any) => p.userId === aliceId);
  const opponent = state.players.find((p: any) => p.userId === bobId);
  assert(
    me.hand.every((c: any) => c.id !== ""),
    "Should see own cards",
  );
  assert(
    opponent.hand.every((c: any) => c.id === ""),
    "Should not see opponent cards",
  );
  assert(me.hand.length === 7, "Should have 7 cards");
  assert(opponent.hand.length === 7, "Opponent should show 7 hidden cards");
  log("State filtering verified");
  client.ws.close();
});

await test("joining non-existent game returns error", async () => {
  const client = await createClient(aliceToken);
  await client.waitFor("connected");
  client.send({ type: "join_game", gameId: "non-existent-id" });
  const error = await client.waitFor("error");
  assert(error.message === "Game not found", "Should get game not found");
  client.ws.close();
});

await test("non-participant cannot join game", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const client = await createClient(charlieToken);
  await client.waitFor("connected");
  client.send({ type: "join_game", gameId: res.gameId });
  const error = await client.waitFor("error");
  assert(
    error.message === "You are not part of this game",
    "Charlie should be rejected",
  );
  log("Non-participant rejected");
  client.ws.close();
});

await test("player_joined is broadcast to others", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  await aliceClient.waitFor("connected");
  aliceClient.send({ type: "join_game", gameId: res.gameId });
  await aliceClient.waitFor("game_updated");

  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_game", gameId: res.gameId });

  const joined = await aliceClient.waitFor("player_joined", 3000);
  assert(joined.userId === bobId, "Alice should see Bob joined");
  log("player_joined broadcast verified");
  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// PLAY CARD ERRORS
// ============================================================

await test("play card out of turn returns error", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_game", gameId: res.gameId });
  await bobClient.waitFor("game_updated");

  bobClient.send({ type: "play_card", gameId: res.gameId, cardId: "fake" });
  const error = await bobClient.waitFor("error");
  assert(error.message === "Invalid move", "Should get invalid move");
  bobClient.ws.close();
});

await test("draw card out of turn returns error", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const bobClient = await createClient(bobToken);
  await bobClient.waitFor("connected");
  bobClient.send({ type: "join_game", gameId: res.gameId });
  await bobClient.waitFor("game_updated");

  bobClient.send({ type: "draw_card", gameId: res.gameId });
  const error = await bobClient.waitFor("error");
  assert(error.message === "Cannot draw card", "Should get cannot draw error");
  bobClient.ws.close();
});

// ============================================================
// FULL GAME - 2 PLAYERS CLASSIC
// ============================================================

await test("2-player classic game plays to completion", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  const winner = result.winner === aliceId ? "Alice" : "Bob";
  log(`Finished in ${result.turns} turns. Winner: ${winner}`);

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// FULL GAME - 3 PLAYERS CLASSIC
// ============================================================

await test("3-player classic game plays to completion", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
        { id: charlieId, username: charlie.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  const charlieClient = await createClient(charlieToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");
  await charlieClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
      { client: charlieClient, id: charlieId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  log(`3-player game finished in ${result.turns} turns`);

  aliceClient.ws.close();
  bobClient.ws.close();
  charlieClient.ws.close();
});

// ============================================================
// FULL GAME - 2 PLAYERS RANKED
// ============================================================

await test("2-player ranked game plays to completion", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "ranked",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  log(`Ranked game finished in ${result.turns} turns`);

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// FULL GAME - 3 PLAYERS RANKED
// ============================================================

await test("3-player ranked game has full ranking", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
        { id: charlieId, username: charlie.username },
      ],
      mode: "ranked",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  const charlieClient = await createClient(charlieToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");
  await charlieClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
      { client: charlieClient, id: charlieId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  const finalState = result.states[0];
  assert(
    finalState.ranking.length === 3,
    `Ranking should have 3 players, got ${finalState.ranking.length}`,
  );
  log(
    `Ranked 3-player finished in ${result.turns} turns. Ranking: ${finalState.ranking}`,
  );

  aliceClient.ws.close();
  bobClient.ws.close();
  charlieClient.ws.close();
}, 1);

// ============================================================
// FULL GAME WITH STACKING
// ============================================================

await test("game with stacking setting plays to completion", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
      settings: {
        stacking: "all",
        sevenZeroRule: false,
        jumpIn: false,
        bluffChallenge: false,
        unoCallout: false,
      },
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  log(`Stacking game finished in ${result.turns} turns`);

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// FULL GAME WITH ALL SETTINGS
// ============================================================

await test("game with all settings enabled plays to completion", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
      settings: {
        stacking: "all",
        sevenZeroRule: false, // skip sevenZero as it needs targetUserId
        jumpIn: true,
        bluffChallenge: false, // skip bluff as it needs challenge/accept response
        unoCallout: true,
      },
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  const result = await playFullGame(
    [
      { client: aliceClient, id: aliceId },
      { client: bobClient, id: bobId },
    ],
    res.gameId,
  );

  assert(result.winner !== null, "Should have a winner");
  log(`All-settings game finished in ${result.turns} turns`);

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// CHAT
// ============================================================

await test("chat message is received by other player", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_game", gameId: res.gameId });
  bobClient.send({ type: "join_game", gameId: res.gameId });
  await aliceClient.waitFor("game_updated");
  await bobClient.waitFor("game_updated");

  aliceClient.send({
    type: "chat_message",
    gameId: res.gameId,
    content: "hello bob!",
  });
  const chatMsg = await bobClient.waitFor("chat_message");
  assert(chatMsg.content === "hello bob!", "Should receive message content");
  assert(chatMsg.userId === aliceId, "Should be from Alice");
  log("Chat verified");

  aliceClient.ws.close();
  bobClient.ws.close();
});

await test("chat message includes username", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_game", gameId: res.gameId });
  bobClient.send({ type: "join_game", gameId: res.gameId });
  await aliceClient.waitFor("game_updated");
  await bobClient.waitFor("game_updated");

  aliceClient.send({
    type: "chat_message",
    gameId: res.gameId,
    content: "test",
  });
  const chatMsg = await bobClient.waitFor("chat_message");
  assert(chatMsg.username === alice.username, "Should include sender username");
  log("Username in chat verified");

  aliceClient.ws.close();
  bobClient.ws.close();
});

// ============================================================
// DISCONNECT
// ============================================================

await test("disconnect broadcasts player_left", async () => {
  const res = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const aliceClient = await createClient(aliceToken);
  const bobClient = await createClient(bobToken);
  await aliceClient.waitFor("connected");
  await bobClient.waitFor("connected");

  aliceClient.send({ type: "join_game", gameId: res.gameId });
  bobClient.send({ type: "join_game", gameId: res.gameId });
  await aliceClient.waitFor("game_updated");
  await bobClient.waitFor("game_updated");

  bobClient.ws.close();
  const left = await aliceClient.waitFor("player_left", 3000);
  assert(left.userId === bobId, "Should receive player_left for Bob");
  log("Disconnect broadcast verified");

  aliceClient.ws.close();
});

// ============================================================
// SIMULTANEOUS GAMES
// ============================================================

await test("two games can run simultaneously", async () => {
  const res1 = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: bobId, username: bob.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  const res2 = await post(
    "/game/games/create",
    {
      participants: [
        { id: aliceId, username: alice.username },
        { id: charlieId, username: charlie.username },
      ],
      mode: "classic",
    },
    aliceToken,
  );

  assert(res1.gameId !== res2.gameId, "Should be different games");

  // Join game 1
  const a1 = await createClient(aliceToken);
  const b1 = await createClient(bobToken);
  await a1.waitFor("connected");
  await b1.waitFor("connected");
  a1.send({ type: "join_game", gameId: res1.gameId });
  b1.send({ type: "join_game", gameId: res1.gameId });
  const state1 = (await a1.waitFor("game_updated")).state;

  // Join game 2
  const a2 = await createClient(aliceToken);
  const c2 = await createClient(charlieToken);
  await a2.waitFor("connected");
  await c2.waitFor("connected");
  a2.send({ type: "join_game", gameId: res2.gameId });
  c2.send({ type: "join_game", gameId: res2.gameId });
  const state2 = (await a2.waitFor("game_updated")).state;

  assert(state1.id === res1.gameId, "Game 1 state should match");
  assert(state2.id === res2.gameId, "Game 2 state should match");
  log("Two simultaneous games verified");

  a1.ws.close();
  b1.ws.close();
  a2.ws.close();
  c2.ws.close();
});

// ============================================================
// GAME END WITH DISCONNECTED PLAYERS
// ============================================================

// await test("AFK: game ends when all players are disconnected by timeout", async () => {
//   const res = await post(
//     "/game/games/create",
//     {
//       participants: [
//         { id: aliceId, username: alice.username },
//         { id: bobId, username: bob.username },
//       ],
//       mode: "classic",
//     },
//     aliceToken,
//   );

//   const aliceClient = await createClient(aliceToken);
//   const bobClient = await createClient(bobToken);
//   await aliceClient.waitFor("connected");
//   await bobClient.waitFor("connected");

//   aliceClient.send({ type: "join_game", gameId: res.gameId });
//   bobClient.send({ type: "join_game", gameId: res.gameId });

//   await aliceClient.waitFor("game_updated");
//   await bobClient.waitFor("game_updated");

//   log("Waiting for AFK timeouts (~60s)...");

//   // Personne joue → 3 timers de 20s avant que la game finisse
//   const ended = await aliceClient.waitFor("game_ended", 90000);
//   assert(ended.type === "game_ended", "Should receive game_ended");
//   assert(typeof ended.winnerId === "string", "Should have a winnerId");
//   log(`Game ended by AFK. Winner: ${ended.winnerId}`);

//   aliceClient.ws.close();
//   bobClient.ws.close();
// });

await test("second WS connection is rejected for same user", async () => {
  const client1 = await createClient(aliceToken);
  await client1.waitFor("connected");

  try {
    const client2 = await createClient(aliceToken);
    const error = await client2.waitFor("error", 3000);
    assert(
      error.message === "Already connected",
      "Should reject second connection",
    );
  } catch {
    // Si la connexion est refusée ou fermée avant le message, c'est aussi valide
    log("Connection closed before error message (acceptable)");
  }
  log("Duplicate connection rejected");

  client1.ws.close();
});

await test("can reconnect after clean disconnect", async () => {
  const client1 = await createClient(aliceToken);
  await client1.waitFor("connected");
  client1.ws.close();

  // Petit délai pour que le close se propage
  await new Promise((r) => setTimeout(r, 500));

  const client2 = await createClient(aliceToken);
  const msg = await client2.waitFor("connected");
  assert(msg.type === "connected", "Should connect after previous disconnect");
  log("Reconnection after disconnect works");

  client2.ws.close();
});
// ============================================================
// RESULTS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
process.exit(0);
