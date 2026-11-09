import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import gameGateway from "../src/gateway/game.gateway.js";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";

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

// ============================================================
// HELPERS
// ============================================================

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const gameManager = new GameManager();
  const roomManager = new RoomManager();

  fastify.register(cookie);
  fastify.register(jwt, { secret: JWT_SECRET });

  // Mock Prisma
  fastify.decorate("prisma", {
    match: {
      create: async () => ({}),
    },
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

function connectWs(
  port: number,
  token: string,
): Promise<{ ws: WebSocket; firstMsg: any }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: `access_token=${token}` },
    });
    ws.once("message", (data) => {
      resolve({ ws, firstMsg: JSON.parse(data.toString()) });
    });
    ws.on("error", reject);
  });
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Monte un serveur + un client connecté, et garantit le nettoyage
async function withClient(
  fn: (env: {
    fastify: Awaited<ReturnType<typeof buildServer>>["fastify"];
    gameManager: GameManager;
    roomManager: RoomManager;
    ws: WebSocket;
    userId: string;
  }) => Promise<void>,
) {
  const { fastify, port, gameManager, roomManager } = await buildServer();
  const userId = uniqueUserId();
  let ws: WebSocket | null = null;
  try {
    const token = fastify.jwt.sign({ id: userId });
    const conn = await connectWs(port, token);
    ws = conn.ws;
    assert(
      conn.firstMsg.type === "connected",
      `Doit recevoir connected, a reçu ${JSON.stringify(conn.firstMsg)}`,
    );
    await fn({ fastify, gameManager, roomManager, ws, userId });
  } finally {
    if (ws) ws.close();
    await sleep(50); // laisse le handler "close" du serveur nettoyer
    await fastify.close();
  }
}

// Crée une room, retourne son code (le serveur répond par room_updated)
async function createRoom(
  ws: WebSocket,
  maxPlayers = 4,
  name = "Test Room",
): Promise<string> {
  send(ws, { type: "create_room", mode: GameMode.CLASSIC, maxPlayers, name });
  const msg = await waitForMessage(ws, "room_updated");
  const code = msg.room?.code ?? msg.room?.roomCode;
  assert(
    code !== undefined,
    `room_updated doit contenir le code, a reçu ${JSON.stringify(msg)}`,
  );
  return code;
}

// Crée une room avec un bot et lance la partie, retourne le gameId
async function setupBotGame(ws: WebSocket, maxPlayers = 2): Promise<string> {
  const roomCode = await createRoom(ws, maxPlayers, "Bot Game");

  send(ws, { type: "add_bot", roomCode });
  await waitForMessage(ws, "room_updated");

  send(ws, { type: "start_game", roomCode });
  const gameStarted = await waitForMessage(ws, "game_started");
  const gameId = gameStarted.gameId;
  assert(gameId !== undefined, "Doit recevoir un gameId");

  send(ws, { type: "join_game", gameId });
  await waitForMessage(ws, "game_updated");

  return gameId;
}

// ============================================================
// TESTS
// ============================================================

const tests = [
  test("e2e: connexion WS avec token valide", async () => {
    await withClient(async () => {
      // withClient vérifie déjà le message "connected"
    });
  }),

  test("e2e: connexion WS refuse sans token", async () => {
    const { fastify, port } = await buildServer();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    try {
      const msg = await waitForMessage(ws, "error", 5000);
      assert(msg.type === "error", "Doit recevoir une erreur");
    } finally {
      ws.close();
      await fastify.close();
    }
  }),

  test("e2e: connexion WS refuse token invalide", async () => {
    const { fastify, port } = await buildServer();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      headers: { Cookie: "access_token=nimportequoi" },
    });
    try {
      const msg = await waitForMessage(ws, "error", 5000);
      assert(msg.type === "error", "Doit recevoir une erreur");
    } finally {
      ws.close();
      await fastify.close();
    }
  }),

  test("e2e: créer une room", async () => {
    await withClient(async ({ ws, roomManager }) => {
      const code = await createRoom(ws);
      assert(roomManager.getRoom(code) !== undefined, "La room doit exister");
    });
  }),

  test("e2e: ajouter un bot à une room", async () => {
    await withClient(async ({ ws }) => {
      const roomCode = await createRoom(ws, 4, "Bot Room");

      send(ws, { type: "add_bot", roomCode });
      const updated = await waitForMessage(ws, "room_updated");

      assert(
        updated.room.players.length === 2,
        `Doit avoir 2 joueurs, a ${updated.room.players.length}`,
      );
      const bot = updated.room.players.find((p: any) =>
        p.id.startsWith("bot_"),
      );
      assert(bot !== undefined, "Un joueur doit être un bot");
    });
  }),

  test("e2e: ajouter plusieurs bots, noms uniques", async () => {
    await withClient(async ({ ws }) => {
      const roomCode = await createRoom(ws, 4, "Multi Bot");

      let last: any;
      for (let i = 0; i < 3; i++) {
        send(ws, { type: "add_bot", roomCode });
        last = await waitForMessage(ws, "room_updated");
      }

      assert(last.room.players.length === 4, "Doit avoir 4 joueurs");
      const ids = last.room.players.map((p: any) => p.id);
      assert(new Set(ids).size === ids.length, "Les ids doivent être uniques");
    });
  }),

  test("e2e: refuse d'ajouter un bot si la room est pleine", async () => {
    await withClient(async ({ ws }) => {
      const roomCode = await createRoom(ws, 2, "Full Room");

      send(ws, { type: "add_bot", roomCode });
      await waitForMessage(ws, "room_updated");

      send(ws, { type: "add_bot", roomCode });
      const err = await waitForMessage(ws, "error");
      assert(err.type === "error", "Doit refuser un bot de trop");
    });
  }),

  test("e2e: le bot joue automatiquement quand c'est son tour", async () => {
    await withClient(async ({ ws, gameManager, userId }) => {
      const gameId = await setupBotGame(ws);
      const game = gameManager.getGame(gameId)!;
      const current = game.players.find((p) => p.isCurrentTurn)!;

      if (current.userId === userId) {
        // L'humain pioche pour passer la main au bot
        send(ws, { type: "draw_card", gameId });
        await waitForMessage(ws, "game_updated");
      }

      // Le bot doit jouer seul en moins de 3s
      const botPlay = await waitForMessage(ws, "game_updated", 3000);
      assert(botPlay.state !== undefined, "Le bot doit avoir joué");
    });
  }),

  test("e2e: l'humain garde son identité après le tour du bot", async () => {
    await withClient(async ({ ws, gameManager, userId }) => {
      const gameId = await setupBotGame(ws);
      const game = gameManager.getGame(gameId)!;
      const bot = game.players.find((p) => p.userId.startsWith("bot_"))!;

      // Attendre que ce soit au tour de l'humain après au moins un tour du bot
      let botHasPlayed = false;
      for (let i = 0; i < 20; i++) {
        const current = game.players.find((p) => p.isCurrentTurn)!;
        if (current.userId === userId) {
          if (botHasPlayed) break;
          send(ws, { type: "draw_card", gameId });
          await waitForMessage(ws, "game_updated");
        } else {
          botHasPlayed = true;
          await sleep(1800);
        }
      }
      assert(botHasPlayed, "Le bot doit avoir joué au moins une fois");

      // L'humain pioche : c'est sa main qui doit grossir, pas celle du bot
      const human = game.players.find((p) => p.userId === userId)!;
      const humanBefore = human.hand.length;
      const botBefore = bot.hand.length;

      send(ws, { type: "draw_card", gameId });
      await waitForMessage(ws, "game_updated");

      assert(
        human.hand.length === humanBefore + 1,
        `La main de l'humain doit avoir +1 (avant ${humanBefore}, après ${human.hand.length})`,
      );
      assert(
        bot.hand.length === botBefore,
        "La main du bot ne doit pas changer quand l'humain pioche",
      );
    });
  }),

  test("e2e: la main revient à l'humain après les tours du bot", async () => {
    await withClient(async ({ ws, gameManager, userId }) => {
      const gameId = await setupBotGame(ws);
      const game = gameManager.getGame(gameId)!;

      const current = game.players.find((p) => p.isCurrentTurn)!;
      if (current.userId === userId) {
        send(ws, { type: "draw_card", gameId });
        await waitForMessage(ws, "game_updated");
      }

      // Le bot peut enchaîner plusieurs tours (skip, reverse, +2 à 2 joueurs).
      // On compte les game_updated pour distinguer « le bot joue encore » de
      // « le bot est bloqué ».
      let updates = 0;
      const counter = (data: any) => {
        if (JSON.parse(data.toString()).type === "game_updated") updates++;
      };
      ws.on("message", counter);

      let backToHuman = false;
      let lastUpdates = 0;
      let idleChecks = 0;
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        const now = game.players.find((p) => p.isCurrentTurn);
        if (
          !now ||
          now.userId === userId ||
          game.status === GameStatus.FINISHED
        ) {
          backToHuman = true;
          break;
        }
        // Le bot joue en 0,5 à 1,5 s : 3 s sans aucun coup = bot bloqué
        if (updates === lastUpdates) idleChecks++;
        else idleChecks = 0;
        lastUpdates = updates;
        assert(
          idleChecks < 6,
          "Le bot semble bloqué : plus aucun coup depuis 3s",
        );
      }

      ws.off("message", counter);
      assert(backToHuman, "Le tour doit revenir à l'humain après le bot");
    });
  }),

  test("e2e: partie complète humain vs bot", async () => {
    await withClient(async ({ ws, gameManager, userId }) => {
      const gameId = await setupBotGame(ws);

      const gameEnded = waitForMessage(ws, "game_ended", 120000).catch(
        () => null,
      );

      let updates = 0;
      let errors = 0;
      const counter = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "game_updated") updates++;
        if (msg.type === "error") errors++;
      };
      ws.on("message", counter);

      // L'humain joue la première carte valide, sinon pioche
      let turns = 0;
      const maxTurns = 300;
      while (turns < maxTurns) {
        const game = gameManager.getGame(gameId);
        if (!game || game.status === GameStatus.FINISHED) break;

        const current = game.players.find((p) => p.isCurrentTurn);
        if (!current) break;

        if (current.userId === userId) {
          turns++;
          const playable = current.hand.find(
            (c) =>
              c.color !== "wild" &&
              (c.color === game.currentColor || c.value === game.topCard.value),
          );
          if (playable && game.pendingDrawCount === 0) {
            send(ws, { type: "play_card", gameId, cardId: playable.id });
          } else {
            send(ws, { type: "draw_card", gameId });
          }
          await sleep(100);
        } else {
          await sleep(300);
        }
      }

      ws.off("message", counter);

      const game = gameManager.getGame(gameId);
      const ended = await Promise.race([
        gameEnded,
        sleep(2000).then(() => null),
      ]);

      assert(updates > 0, "La partie doit avoir généré des game_updated");
      assert(
        errors === 0,
        `L'humain ne doit recevoir aucune erreur, en a reçu ${errors}`,
      );
      assert(
        turns < maxTurns,
        `La partie ne doit pas dépasser ${maxTurns} tours humains`,
      );
      assert(
        ended !== null || !game || game.status === GameStatus.FINISHED,
        "La partie doit se terminer",
      );
    });
  }),
];

// ============================================================
// RUNNER
// ============================================================

async function run() {
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
