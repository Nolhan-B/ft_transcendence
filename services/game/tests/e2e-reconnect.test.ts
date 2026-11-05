import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";

// Délai de grâce court pour les tests : doit être défini AVANT de charger le gateway
const GRACE_MS = 500;
process.env.RECONNECT_GRACE_MS = String(GRACE_MS);

let gameGateway: any;

let passed = 0;
let failed = 0;

const JWT_SECRET = "test-secret";

let userCounter = 0;
function uniqueUserId(): string {
  userCounter++;
  return `player_${Date.now()}_${userCounter}`;
}

function test(name: string, fn: () => Promise<void>) {
  return { name, fn };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// HELPERS
// ============================================================

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const gameManager = new GameManager();
  const roomManager = new RoomManager();

  fastify.register(cookie);
  fastify.register(jwt, { secret: JWT_SECRET });

  fastify.decorate("prisma", {
    match: { create: async () => ({}) },
    user: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        username: `user_${where.id}`,
      }),
    },
  } as any);

  fastify.decorate("gameManager", gameManager);
  fastify.decorate("roomManager", roomManager);

  fastify.register(websocket);
  fastify.register(gameGateway);

  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const address = fastify.server.address();
  const port = typeof address === "object" ? address!.port : 0;

  return { fastify, port, gameManager, roomManager };
}

type Server = Awaited<ReturnType<typeof buildServer>>;

function connectWs(
  port: number,
  token: string,
): Promise<{ ws: WebSocket; firstMsg: any }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    ws.once("message", (data) => {
      resolve({ ws, firstMsg: JSON.parse(data.toString()) });
    });
    ws.on("error", reject);
  });
}

async function connectUser(server: Server, userId: string): Promise<WebSocket> {
  const token = server.fastify.jwt.sign({ id: userId });
  const { ws, firstMsg } = await connectWs(server.port, token);
  assert(
    firstMsg.type === "connected",
    `Doit recevoir connected, a reçu ${JSON.stringify(firstMsg)}`,
  );
  return ws;
}

function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 10000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`Timeout waiting for "${type}"`));
    }, timeoutMs);
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "error" && type !== "error") {
        clearTimeout(timeout);
        ws.off("message", handler);
        reject(new Error(`Erreur serveur: ${JSON.stringify(msg)}`));
        return;
      }
      if (msg.type === type) {
        clearTimeout(timeout);
        ws.off("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
}

async function closeWs(ws: WebSocket) {
  ws.close();
  await sleep(100); // laisse le handler "close" du serveur s'exécuter
}

async function withServer(fn: (server: Server) => Promise<void>) {
  const server = await buildServer();
  try {
    await fn(server);
  } finally {
    await sleep(50);
    await server.fastify.close();
  }
}

async function createRoom(ws: WebSocket, maxPlayers: number): Promise<string> {
  send(ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers,
    name: "Reconnect Room",
  });
  const msg = await waitForMessage(ws, "room_updated");
  return msg.room.code;
}

// Lance la partie depuis le leader et fait rejoindre tous les sockets humains
async function startAndJoin(
  leader: WebSocket,
  roomCode: string,
  humans: WebSocket[],
): Promise<string> {
  const started = humans.map((ws) => waitForMessage(ws, "game_started"));
  send(leader, { type: "start_game", roomCode });
  const results = await Promise.all(started);
  const gameId = results[0].gameId;
  assert(gameId !== undefined, "Doit recevoir un gameId");

  for (const ws of humans) {
    send(ws, { type: "join_game", gameId });
    await waitForMessage(ws, "game_updated");
  }
  return gameId;
}

// ============================================================
// TESTS
// ============================================================

const tests = [
  test("reconnect: refresh dans le délai → la partie continue", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const ws = await connectUser(server, userId);
      const roomCode = await createRoom(ws, 2);
      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");
      const gameId = await startAndJoin(ws, roomCode, [ws]);

      // Refresh : on ferme et on revient avant la fin du délai
      await closeWs(ws);
      const ws2 = await connectUser(server, userId);
      send(ws2, { type: "join_game", gameId });
      await waitForMessage(ws2, "game_updated");

      // On attend au-delà du délai de grâce
      await sleep(GRACE_MS + 300);

      const game = server.gameManager.getGame(gameId);
      assert(game !== undefined, "La partie doit toujours exister");
      assert(
        game!.status === GameStatus.IN_PROGRESS,
        "La partie doit être en cours",
      );
      const me = game!.players.find((p) => p.userId === userId)!;
      assert(!me.disconnected, "Le joueur ne doit pas être marqué déconnecté");

      ws2.close();
    });
  }),

  test("reconnect: après refresh, le joueur peut encore jouer", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const ws = await connectUser(server, userId);
      const roomCode = await createRoom(ws, 2);
      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");
      const gameId = await startAndJoin(ws, roomCode, [ws]);

      await closeWs(ws);
      const ws2 = await connectUser(server, userId);
      send(ws2, { type: "join_game", gameId });
      await waitForMessage(ws2, "game_updated");

      // Attendre que ce soit le tour de l'humain
      const game = server.gameManager.getGame(gameId)!;
      for (let i = 0; i < 20; i++) {
        const current = game.players.find((p) => p.isCurrentTurn);
        if (current?.userId === userId) break;
        await sleep(300);
      }
      const me = game.players.find((p) => p.userId === userId)!;
      assert(me.isCurrentTurn, "Doit finir par être le tour de l'humain");

      const before = me.hand.length;
      send(ws2, { type: "draw_card", gameId });
      await waitForMessage(ws2, "game_updated");
      assert(
        me.hand.length === before + 1,
        "La pioche doit être acceptée après la reconnexion",
      );

      ws2.close();
    });
  }),

  test("reconnect: humain vs bot, l'humain part → partie terminée après le délai", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const ws = await connectUser(server, userId);
      const roomCode = await createRoom(ws, 2);
      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");
      const gameId = await startAndJoin(ws, roomCode, [ws]);

      await closeWs(ws);

      // Pendant le délai, la partie existe encore
      assert(
        server.gameManager.getGame(gameId) !== undefined,
        "La partie doit exister pendant le délai de grâce",
      );

      await sleep(GRACE_MS + 300);

      assert(
        server.gameManager.getGame(gameId) === undefined,
        "La partie doit être supprimée après le délai",
      );
    });
  }),

  test("reconnect: humain + 2 bots, l'humain part → partie terminée", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const ws = await connectUser(server, userId);
      const roomCode = await createRoom(ws, 3);
      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");
      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");
      const gameId = await startAndJoin(ws, roomCode, [ws]);

      await closeWs(ws);
      await sleep(GRACE_MS + 300);

      assert(
        server.gameManager.getGame(gameId) === undefined,
        "Une partie sans humain doit être terminée",
      );
    });
  }),

  test("reconnect: 1v1 humains, A part → B gagne après le délai", async () => {
    await withServer(async (server) => {
      const idA = uniqueUserId();
      const idB = uniqueUserId();
      const wsA = await connectUser(server, idA);
      const wsB = await connectUser(server, idB);

      const roomCode = await createRoom(wsA, 2);
      send(wsB, { type: "join_room", roomCode });
      await waitForMessage(wsB, "room_updated");

      const gameId = await startAndJoin(wsA, roomCode, [wsA, wsB]);

      const ended = waitForMessage(wsB, "game_ended", GRACE_MS + 3000);
      await closeWs(wsA);

      // Pas de fin immédiate : la partie existe encore juste après le départ
      assert(
        server.gameManager.getGame(gameId) !== undefined,
        "La partie ne doit pas finir immédiatement",
      );

      const msg = await ended;
      assert(msg.winnerId === idB, `B doit gagner, winnerId = ${msg.winnerId}`);

      wsB.close();
    });
  }),

  test("reconnect: 1v1 humains, A revient à temps → pas de fin de partie", async () => {
    await withServer(async (server) => {
      const idA = uniqueUserId();
      const idB = uniqueUserId();
      const wsA = await connectUser(server, idA);
      const wsB = await connectUser(server, idB);

      const roomCode = await createRoom(wsA, 2);
      send(wsB, { type: "join_room", roomCode });
      await waitForMessage(wsB, "room_updated");

      const gameId = await startAndJoin(wsA, roomCode, [wsA, wsB]);

      let endedReceived = false;
      wsB.on("message", (data) => {
        if (JSON.parse(data.toString()).type === "game_ended")
          endedReceived = true;
      });

      await closeWs(wsA);
      const wsA2 = await connectUser(server, idA);
      send(wsA2, { type: "join_game", gameId });
      await waitForMessage(wsA2, "game_updated");

      await sleep(GRACE_MS + 300);

      assert(!endedReceived, "B ne doit pas recevoir game_ended");
      const game = server.gameManager.getGame(gameId);
      assert(
        game?.status === GameStatus.IN_PROGRESS,
        "La partie doit toujours être en cours",
      );

      wsA2.close();
      wsB.close();
    });
  }),

  test("reconnect: B est prévenu du départ de A (player_left)", async () => {
    await withServer(async (server) => {
      const idA = uniqueUserId();
      const idB = uniqueUserId();
      const wsA = await connectUser(server, idA);
      const wsB = await connectUser(server, idB);

      const roomCode = await createRoom(wsA, 2);
      send(wsB, { type: "join_room", roomCode });
      await waitForMessage(wsB, "room_updated");
      await startAndJoin(wsA, roomCode, [wsA, wsB]);

      const left = waitForMessage(wsB, "player_left", 2000);
      wsA.close();
      const msg = await left;
      assert(msg.userId === idA, "player_left doit concerner A");

      wsB.close();
    });
  }),

  test("reconnect: le joueur parti avait la main → elle passe au suivant", async () => {
    await withServer(async (server) => {
      const idA = uniqueUserId();
      const idB = uniqueUserId();
      const wsA = await connectUser(server, idA);
      const wsB = await connectUser(server, idB);

      // A (leader) + B + bot : A commence
      const roomCode = await createRoom(wsA, 3);
      send(wsB, { type: "join_room", roomCode });
      await waitForMessage(wsB, "room_updated");
      send(wsA, { type: "add_bot", roomCode });
      await waitForMessage(wsA, "room_updated");

      const gameId = await startAndJoin(wsA, roomCode, [wsA, wsB]);
      const game = server.gameManager.getGame(gameId)!;
      const a = game.players.find((p) => p.userId === idA)!;
      assert(a.isCurrentTurn, "A doit avoir la main au départ");

      await closeWs(wsA);
      await sleep(GRACE_MS + 300);

      assert(a.disconnected, "A doit être marqué déconnecté");
      assert(!a.isCurrentTurn, "A ne doit plus avoir la main");
      assert(
        game.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer (B + bot)",
      );

      wsB.close();
    });
  }),
];

// ============================================================
// RUNNER
// ============================================================

async function run() {
  // Import dynamique : la variable d'env doit être posée avant le chargement
  gameGateway = (await import("../src/gateway/game.gateway.js")).default;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${t.name}: ${msg}`);
      failed++;
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
