import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";
import { QueueManager } from "../src/managers/queue.manager.js";

// Délais courts pour les tests : doivent être définis AVANT de charger le gateway
const TURN_MS = 1500;
process.env.TURN_TIMEOUT_MS = String(TURN_MS);
process.env.RECONNECT_GRACE_MS = "5000";
const JOIN_TIMEOUT_MS = 1000;
process.env.GAME_JOIN_TIMEOUT_MS = String(JOIN_TIMEOUT_MS);

let gameGateway: any;

let passed = 0;
let failed = 0;

const JWT_SECRET = "test-secret";

let userCounter = 0;
function uniqueUserId(prefix = "player"): string {
  userCounter++;
  return `${prefix}_${Date.now()}_${userCounter}`;
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
  const sockets: WebSocket[] = [];
  // Parties enregistrees par endGame, pour verifier gagnant et classement
  const matches: any[] = [];

  fastify.register(cookie);
  fastify.register(jwt, { secret: JWT_SECRET });

  fastify.decorate("prisma", {
    match: {
      create: async ({ data }: any) => {
        matches.push(data);
        return {};
      },
    },
    user: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        username: `user_${where.id}`,
        elo: 1000,
      }),
      findMany: async ({ where }: any) =>
        where.id.in.map((id: string) => ({ id, elo: 1000 })),
      update: async () => ({}),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as any);

  fastify.decorate("gameManager", gameManager);
  fastify.decorate("roomManager", roomManager);
  fastify.decorate("queueManager", new QueueManager());

  fastify.register(websocket);
  fastify.register(gameGateway);

  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const address = fastify.server.address();
  const port = typeof address === "object" ? address!.port : 0;

  return { fastify, port, gameManager, roomManager, sockets, matches };
}

type Server = Awaited<ReturnType<typeof buildServer>>;

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

async function connectUser(server: Server, userId: string): Promise<WebSocket> {
  const token = server.fastify.jwt.sign({ id: userId });
  const { ws, firstMsg } = await connectWs(server.port, token);
  assert(
    firstMsg.type === "connected",
    `Doit recevoir connected, a reçu ${JSON.stringify(firstMsg)}`,
  );
  server.sockets.push(ws);
  return ws;
}

function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 5000,
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

function collect(ws: WebSocket, ms: number): Promise<any[]> {
  return new Promise((resolve) => {
    const messages: any[] = [];
    const handler = (data: any) => messages.push(JSON.parse(data.toString()));
    ws.on("message", handler);
    setTimeout(() => {
      ws.off("message", handler);
      resolve(messages);
    }, ms);
  });
}

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
}

async function withServer(fn: (server: Server) => Promise<void>) {
  const server = await buildServer();
  try {
    await fn(server);
  } finally {
    for (const ws of server.sockets) ws.close();
    await sleep(50);
    await server.fastify.close();
  }
}

const SETTINGS = {
  stacking: "none",
  sevenZeroRule: false,
  jumpIn: false,
  bluffChallenge: true,
  unoCallout: true,
};

interface Human {
  id: string;
  ws: WebSocket;
}

// Partie entre 3 humains (A commence), avec bluff et UNO activés
async function setupGame(server: Server, nb = 3) {
  const players: Human[] = [];
  for (let i = 0; i < nb; i++) {
    const id = uniqueUserId(["alice", "bob", "charlie"][i]);
    players.push({ id, ws: await connectUser(server, id) });
  }
  const [a, ...others] = players;

  send(a.ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers: nb,
    name: "actions",
  });
  const created = await waitForMessage(a.ws, "room_updated");
  const roomCode = created.room.code;

  send(a.ws, { type: "update_room", roomCode, settings: SETTINGS });
  await waitForMessage(a.ws, "room_updated");

  for (const p of others) {
    send(p.ws, { type: "join_room", roomCode });
    await waitForMessage(p.ws, "room_updated");
  }

  const started = players.map((p) => waitForMessage(p.ws, "game_started"));
  send(a.ws, { type: "start_game", roomCode });
  const gameId = (await Promise.all(started))[0].gameId;

  for (const p of players) {
    send(p.ws, { type: "join_game", gameId });
    await waitForMessage(p.ws, "game_updated");
  }

  const game = server.gameManager.getGame(gameId)!;
  assert(game.settings.bluffChallenge, "Le bluff doit être activé");
  assert(game.players[0].userId === a.id, "A doit commencer");
  return { players, gameId, game };
}

// A pose un +4 : B devient la victime (c'est son tour)
async function setupBluff(server: Server) {
  const ctx = await setupGame(server);
  const [a] = ctx.players;
  ctx.game.topCard = { id: "top", color: "red", value: "5" };
  ctx.game.currentColor = "red";
  ctx.game.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "keep", color: "blue", value: "1" },
  ];
  // Tout le monde doit avoir reçu la mise à jour avant de continuer
  const updates = ctx.players.map((p) => waitForMessage(p.ws, "game_updated"));
  send(a.ws, {
    type: "play_card",
    gameId: ctx.gameId,
    cardId: "wd",
    chosenColor: "green",
  });
  await Promise.all(updates);
  assert(
    ctx.game.lastWildDraw4 !== undefined,
    "Le +4 doit être en attente de réponse",
  );
  assert(
    ctx.game.players[1].isCurrentTurn,
    "Ce doit être au tour de B, la victime",
  );
  return ctx;
}

// A passe à une seule carte sans dire UNO : il devient attrapable
async function setupUno(server: Server) {
  const ctx = await setupGame(server);
  const [a] = ctx.players;
  ctx.game.topCard = { id: "top", color: "red", value: "5" };
  ctx.game.currentColor = "red";
  ctx.game.players[0].hand = [
    { id: "r3", color: "red", value: "3" },
    { id: "last", color: "blue", value: "1" },
  ];
  // Tout le monde doit avoir reçu la mise à jour avant de continuer
  const updates = ctx.players.map((p) => waitForMessage(p.ws, "game_updated"));
  send(a.ws, { type: "play_card", gameId: ctx.gameId, cardId: "r3" });
  await Promise.all(updates);
  assert(ctx.game.players[0].hand.length === 1, "A doit avoir 1 carte");
  return ctx;
}

async function waitUntil(cond: () => boolean, timeoutMs: number) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) return false;
    await sleep(50);
  }
  return true;
}

// Partie entre `nbHumans` humains (A commence) puis un bot en dernier siege
async function setupGameWithBot(server: Server, nbHumans: number) {
  const humans: Human[] = [];
  for (let i = 0; i < nbHumans; i++) {
    const id = uniqueUserId(["alice", "bob"][i]);
    humans.push({ id, ws: await connectUser(server, id) });
  }
  const [a, ...others] = humans;

  send(a.ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers: nbHumans + 1,
    name: "bot-timer",
  });
  const roomCode = (await waitForMessage(a.ws, "room_updated")).room.code;
  send(a.ws, { type: "update_room", roomCode, settings: SETTINGS });
  await waitForMessage(a.ws, "room_updated");
  for (const p of others) {
    send(p.ws, { type: "join_room", roomCode });
    await waitForMessage(p.ws, "room_updated");
  }
  send(a.ws, { type: "add_bot", roomCode });
  await waitForMessage(a.ws, "room_updated");

  const started = humans.map((p) => waitForMessage(p.ws, "game_started"));
  send(a.ws, { type: "start_game", roomCode });
  const gameId = (await Promise.all(started))[0].gameId;
  for (const p of humans) {
    send(p.ws, { type: "join_game", gameId });
    await waitForMessage(p.ws, "game_updated");
  }

  const game = server.gameManager.getGame(gameId)!;
  const bot = game.players[nbHumans];
  assert(bot.userId.startsWith("bot_"), "Le dernier siège doit être un bot");
  // Main du bot deterministe : seul le rouge 3 est jouable sur un rouge 5
  game.topCard = { id: "top", color: "red", value: "5" };
  game.currentColor = "red";
  bot.hand = [
    { id: "bot_r3", color: "red", value: "3" },
    { id: "bot_b1", color: "blue", value: "1" },
  ];
  return { humans, gameId, game, bot };
}

// ============================================================
// TESTS
// ============================================================

const tests = [
  // ---------------- challenge_bluff ----------------

  test("bluff: la victime peut contester", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupBluff(server);
      const [, b] = players;
      send(b.ws, { type: "challenge_bluff", gameId });
      const res = await waitForMessage(b.ws, "bluff_result");
      assert(res.challengerUserId === b.id, "Le challenger doit être B");
    });
  }),

  test("bluff: le poseur du +4 ne peut pas contester", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupBluff(server);
      const [a] = players;
      send(a.ws, { type: "challenge_bluff", gameId });
      const err = await waitForMessage(a.ws, "error");
      assert(
        err.message === "Only the targeted player can respond to this card",
        `Message inattendu : ${err.message}`,
      );
      assert(
        game.lastWildDraw4 !== undefined,
        "Le +4 doit toujours être en attente",
      );
    });
  }),

  test("bluff: un autre joueur de la partie ne peut pas contester", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupBluff(server);
      const c = players[2];
      const handsBefore = game.players.map((p) => p.hand.length).join();
      send(c.ws, { type: "challenge_bluff", gameId });
      const err = await waitForMessage(c.ws, "error");
      assert(
        err.message === "Only the targeted player can respond to this card",
        `Message inattendu : ${err.message}`,
      );
      assert(
        game.players.map((p) => p.hand.length).join() === handsBefore,
        "Aucune main ne doit changer",
      );
    });
  }),

  test("bluff: un utilisateur extérieur ne peut pas contester", async () => {
    await withServer(async (server) => {
      const { gameId, game } = await setupBluff(server);
      const outsider = await connectUser(server, uniqueUserId("outsider"));
      send(outsider, { type: "challenge_bluff", gameId });
      await waitForMessage(outsider, "error");
      assert(
        game.lastWildDraw4 !== undefined,
        "Le +4 doit toujours être en attente",
      );
    });
  }),

  test("bluff: un spectateur ne peut pas contester", async () => {
    await withServer(async (server) => {
      const { gameId, game } = await setupBluff(server);
      const watcher = await connectUser(server, uniqueUserId("watcher"));
      send(watcher, { type: "spectate_game", gameId });
      await waitForMessage(watcher, "spectate_started");
      send(watcher, { type: "challenge_bluff", gameId });
      await waitForMessage(watcher, "error");
      assert(
        game.lastWildDraw4 !== undefined,
        "Le +4 doit toujours être en attente",
      );
    });
  }),

  // ---------------- accept_wild_draw4 ----------------

  test("bluff: la victime peut accepter et pioche 4 cartes", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupBluff(server);
      const [, b] = players;
      const before = game.players[1].hand.length;
      const update = waitForMessage(b.ws, "game_updated");
      send(b.ws, { type: "accept_wild_draw4", gameId });
      await update;
      assert(
        game.players[1].hand.length === before + 4,
        "B doit piocher 4 cartes",
      );
      assert(
        game.lastWildDraw4 === undefined,
        "Le +4 ne doit plus être en attente",
      );
    });
  }),

  test("bluff: le poseur du +4 ne peut pas accepter à la place de la victime", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupBluff(server);
      const [a] = players;
      const before = game.players.map((p) => p.hand.length).join();
      send(a.ws, { type: "accept_wild_draw4", gameId });
      await waitForMessage(a.ws, "error");
      assert(
        game.players.map((p) => p.hand.length).join() === before,
        "Aucune main ne doit changer",
      );
      assert(
        game.players[1].isCurrentTurn,
        "Ce doit toujours être au tour de B",
      );
    });
  }),

  test("bluff: un autre joueur ne peut pas accepter à la place de la victime", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupBluff(server);
      const c = players[2];
      send(c.ws, { type: "accept_wild_draw4", gameId });
      await waitForMessage(c.ws, "error");
      assert(
        game.lastWildDraw4 !== undefined,
        "Le +4 doit toujours être en attente",
      );
    });
  }),

  test("bluff: un utilisateur extérieur ne peut pas accepter", async () => {
    await withServer(async (server) => {
      const { gameId, game } = await setupBluff(server);
      const outsider = await connectUser(server, uniqueUserId("outsider"));
      send(outsider, { type: "accept_wild_draw4", gameId });
      await waitForMessage(outsider, "error");
      assert(
        game.lastWildDraw4 !== undefined,
        "Le +4 doit toujours être en attente",
      );
    });
  }),

  // ---------------- catch_uno ----------------

  test("uno: un autre joueur peut attraper un oubli, la cible pioche 2", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a, b] = players;
      const caught = waitForMessage(b.ws, "uno_caught");
      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      const msg = await caught;
      assert(
        msg.targetUserId === a.id && msg.catcherUserId === b.id,
        "uno_caught incorrect",
      );
      assert(
        game.players[0].hand.length === 3,
        `A doit avoir 3 cartes, en a ${game.players[0].hand.length}`,
      );
    });
  }),

  test("uno: on ne peut pas s'attraper soi-même", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a] = players;
      send(a.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      const err = await waitForMessage(a.ws, "error");
      assert(
        err.message === "You cannot catch yourself",
        `Message inattendu : ${err.message}`,
      );
      assert(game.players[0].hand.length === 1, "A ne doit pas piocher");
    });
  }),

  test("uno: un utilisateur extérieur ne peut pas attraper", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a] = players;
      const outsider = await connectUser(server, uniqueUserId("outsider"));
      send(outsider, { type: "catch_uno", gameId, targetUserId: a.id });
      const err = await waitForMessage(outsider, "error");
      assert(
        err.message === "You are not part of this game",
        `Message inattendu : ${err.message}`,
      );
      assert(game.players[0].hand.length === 1, "A ne doit pas piocher");
    });
  }),

  test("uno: un spectateur ne peut pas attraper", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a] = players;
      const watcher = await connectUser(server, uniqueUserId("watcher"));
      send(watcher, { type: "spectate_game", gameId });
      await waitForMessage(watcher, "spectate_started");
      send(watcher, { type: "catch_uno", gameId, targetUserId: a.id });
      await waitForMessage(watcher, "error");
      assert(game.players[0].hand.length === 1, "A ne doit pas piocher");
    });
  }),

  test("uno: une cible qui n'est pas dans la partie est refusée", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupUno(server);
      const [, b] = players;
      send(b.ws, {
        type: "catch_uno",
        gameId,
        targetUserId: "quelquun-d-autre",
      });
      const err = await waitForMessage(b.ws, "error");
      assert(
        err.message === "Target is not part of this game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("uno: une requête refusée n'annule pas l'oubli de la cible", async () => {
    // Avant le fix, un mauvais gameId supprimait le timer UNO et « sauvait » la cible
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a, b] = players;

      send(b.ws, {
        type: "catch_uno",
        gameId: "mauvais-id",
        targetUserId: a.id,
      });
      await waitForMessage(b.ws, "error");

      // Le vrai catch doit toujours fonctionner
      const caught = waitForMessage(b.ws, "uno_caught");
      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      await caught;
      assert(
        game.players[0].hand.length === 3,
        "A doit quand même être pénalisé",
      );
    });
  }),

  test("uno: on ne peut pas attraper un joueur qui n'a pas oublié", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupGame(server);
      const [a, b] = players;
      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      const err = await waitForMessage(b.ws, "error");
      assert(
        err.message === "Player already called UNO or not in UNO state",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("uno: on ne peut pas attraper deux fois le même oubli", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a, b, c] = players;
      const caught = waitForMessage(b.ws, "uno_caught");
      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      await caught;

      send(c.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      await waitForMessage(c.ws, "error");
      assert(
        game.players[0].hand.length === 3,
        "A ne doit être pénalisé qu'une fois",
      );
    });
  }),

  // ---------------- Reconnexion et timer du tour ----------------

  test("timer: une reconnexion ne remet pas le timer du tour à zéro", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupGame(server, 2);
      const [a] = players;
      assert(game.players[0].isCurrentTurn, "Ce doit être au tour de A");
      const start = Date.now();

      // A rafraîchit sa page au milieu de son tour
      await sleep(TURN_MS / 2);
      a.ws.close();
      await sleep(100);
      const ws2 = await connectUser(server, a.id);
      send(ws2, { type: "join_game", gameId });
      await waitForMessage(ws2, "game_updated");

      // Le timer d'origine doit expirer à l'heure prévue : A pioche d'office
      // et la main passe à B. Si la reconnexion avait relancé le timer,
      // ce serait encore au tour de A à ce moment-là.
      const elapsed = Date.now() - start;
      await sleep(TURN_MS - elapsed + 300);
      assert(
        game.players[1].isCurrentTurn,
        "Le timer d'origine doit avoir expiré : ce doit être au tour de B",
      );
    });
  }),

  test("timer: sans reconnexion, le joueur AFK perd son tour au bout du délai", async () => {
    // Test témoin : vérifie que le timer fonctionne bien dans ce montage
    await withServer(async (server) => {
      const { game } = await setupGame(server, 2);
      assert(game.players[0].isCurrentTurn, "Ce doit être au tour de A");
      await sleep(TURN_MS + 300);
      assert(game.players[1].isCurrentTurn, "Le tour doit être passé à B");
    });
  }),

  test("timer: la partie continue normalement après une reconnexion", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupGame(server, 2);
      const [a] = players;
      a.ws.close();
      await sleep(100);
      const ws2 = await connectUser(server, a.id);
      send(ws2, { type: "join_game", gameId });
      await waitForMessage(ws2, "game_updated");

      const update = waitForMessage(ws2, "game_updated");
      send(ws2, { type: "draw_card", gameId });
      await update;
      assert(
        game.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer",
      );
      assert(
        game.players[1].isCurrentTurn,
        "Après la pioche de A, c'est au tour de B",
      );

      const msgs = await collect(ws2, 100);
      assert(
        !msgs.some((m) => m.type === "error"),
        "Aucune erreur ne doit arriver",
      );
    });
  }),

  // ---------------- call_uno ----------------

  test("uno: dire UNO prévient tous les joueurs", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupUno(server);
      const [a, b, c] = players;
      const forB = waitForMessage(b.ws, "uno_called");
      const forC = waitForMessage(c.ws, "uno_called");
      send(a.ws, { type: "call_uno", gameId });
      const [mB, mC] = await Promise.all([forB, forC]);
      assert(
        mB.userId === a.id && mC.userId === a.id,
        "L'annonce doit concerner A",
      );
    });
  }),

  test("uno: le joueur qui dit UNO reçoit aussi l'annonce", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupUno(server);
      const [a] = players;
      const forA = waitForMessage(a.ws, "uno_called");
      send(a.ws, { type: "call_uno", gameId });
      const msg = await forA;
      assert(msg.userId === a.id, "L'annonce doit concerner A");
    });
  }),

  test("uno: un spectateur reçoit l'annonce", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupUno(server);
      const [a] = players;
      const watcher = await connectUser(server, uniqueUserId("watcher"));
      send(watcher, { type: "spectate_game", gameId });
      await waitForMessage(watcher, "spectate_started");

      const announced = waitForMessage(watcher, "uno_called");
      send(a.ws, { type: "call_uno", gameId });
      const msg = await announced;
      assert(msg.userId === a.id, "Le spectateur doit voir l'UNO de A");
    });
  }),

  test("uno: après avoir dit UNO, on ne peut plus être attrapé", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a, b] = players;
      const announced = waitForMessage(b.ws, "uno_called");
      send(a.ws, { type: "call_uno", gameId });
      await announced;

      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      const err = await waitForMessage(b.ws, "error");
      assert(
        err.message === "Player already called UNO or not in UNO state",
        `Message inattendu : ${err.message}`,
      );
      assert(game.players[0].hand.length === 1, "A ne doit pas piocher");
    });
  }),

  test("uno: dire UNO hors de la fenêtre UNO → erreur, rien n'est annoncé", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupGame(server);
      const [a, b] = players;
      const msgsB = collect(b.ws, 400);
      send(a.ws, { type: "call_uno", gameId });
      const err = await waitForMessage(a.ws, "error");
      assert(
        err.message === "Nothing to call",
        `Message inattendu : ${err.message}`,
      );
      assert(
        !(await msgsB).some((m) => m.type === "uno_called"),
        "Un faux UNO ne doit pas être annoncé",
      );
    });
  }),

  test("uno: dire UNO deux fois → la seconde est refusée", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupUno(server);
      const [a, b] = players;
      const announced = waitForMessage(b.ws, "uno_called");
      send(a.ws, { type: "call_uno", gameId });
      await announced;

      const msgsB = collect(b.ws, 400);
      send(a.ws, { type: "call_uno", gameId });
      const err = await waitForMessage(a.ws, "error");
      assert(
        err.message === "Nothing to call",
        `Message inattendu : ${err.message}`,
      );
      assert(
        !(await msgsB).some((m) => m.type === "uno_called"),
        "Le second UNO ne doit pas être annoncé",
      );
    });
  }),

  test("uno: un autre joueur ne peut pas dire UNO à la place de la cible", async () => {
    await withServer(async (server) => {
      const { players, gameId, game } = await setupUno(server);
      const [a, b] = players;
      // B n'est pas dans la fenêtre UNO : son annonce est refusée…
      send(b.ws, { type: "call_uno", gameId });
      await waitForMessage(b.ws, "error");
      // …et A peut toujours être attrapé
      const caught = waitForMessage(b.ws, "uno_caught");
      send(b.ws, { type: "catch_uno", gameId, targetUserId: a.id });
      await caught;
      assert(game.players[0].hand.length === 3, "A doit être pénalisé");
    });
  }),

  test("uno: un utilisateur extérieur ne peut pas dire UNO", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupUno(server);
      const outsider = await connectUser(server, uniqueUserId("outsider"));
      send(outsider, { type: "call_uno", gameId });
      const err = await waitForMessage(outsider, "error");
      assert(
        err.message === "You are not part of this game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("uno: call_uno pour une partie inexistante → erreur", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("player"));
      send(ws, { type: "call_uno", gameId: "partie-qui-existe-pas" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Game not found",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("uno: call_uno sans gameId → message refusé", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("player"));
      send(ws, { type: "call_uno" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Invalid message format",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Timers serveur → tour du bot ----------------

  test("bot: après le timeout AFK d'un humain, le bot suivant joue", async () => {
    await withServer(async (server) => {
      const { game, bot } = await setupGameWithBot(server, 1);
      assert(game.players[0].isCurrentTurn, "Ce doit être au tour de A");

      // A ne joue pas : le timer le fait piocher et passe la main au bot
      await sleep(TURN_MS + 100);
      const played = await waitUntil(
        () => !bot.hand.some((c) => c.id === "bot_r3"),
        2500,
      );
      assert(played, "Le bot doit avoir joué son rouge 3");
      assert(!bot.disconnected, "Le bot ne doit pas être compté AFK");
      assert(game.players[0].isCurrentTurn, "La main doit revenir à A");
    });
  }),

  test("bot: après l'expiration du timer de bluff, le bot suivant joue", async () => {
    await withServer(async (server) => {
      const { humans, gameId, game, bot } = await setupGameWithBot(server, 2);
      const [a] = humans;
      const b = game.players[1];
      game.players[0].hand = [
        { id: "wd", color: "wild", value: "wild_draw4" },
        { id: "keep", color: "blue", value: "1" },
      ];
      send(a.ws, {
        type: "play_card",
        gameId,
        cardId: "wd",
        chosenColor: "red",
      });
      await waitForMessage(a.ws, "game_updated");
      assert(b.isCurrentTurn, "B est la victime du +4");
      const bHand = b.hand.length;

      // B ne repond pas : au bout de 5 s il pioche 4, puis c'est au bot
      const played = await waitUntil(
        () => !bot.hand.some((c) => c.id === "bot_r3"),
        5000 + 2500,
      );
      assert(b.hand.length >= bHand + 4, "B doit avoir pioché les 4 cartes");
      assert(played, "Le bot doit avoir joué après le timer de bluff");
      assert(!b.disconnected, "B ne doit pas être compté AFK pendant le bluff");
    });
  }),

  // ---------------- Partie de room jamais rejointe ----------------

  test("room: une partie lancée mais jamais rejointe est supprimée", async () => {
    await withServer(async (server) => {
      const a = { id: uniqueUserId("alice") } as Human;
      const b = { id: uniqueUserId("bob") } as Human;
      a.ws = await connectUser(server, a.id);
      b.ws = await connectUser(server, b.id);

      send(a.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "ghost",
      });
      const roomCode = (await waitForMessage(a.ws, "room_updated")).room.code;
      send(b.ws, { type: "join_room", roomCode });
      await waitForMessage(b.ws, "room_updated");
      const started = waitForMessage(a.ws, "game_started");
      send(a.ws, { type: "start_game", roomCode });
      const { gameId } = await started;

      // Personne ne fait join_game (onglets fermes, navigation ailleurs...)
      await sleep(JOIN_TIMEOUT_MS + 300);
      assert(
        server.gameManager.getGame(gameId) === undefined,
        "La partie fantôme doit être supprimée",
      );

      // Les joueurs ne sont plus bloques : ils peuvent lancer une ranked
      send(a.ws, { type: "join_queue" });
      await waitForMessage(a.ws, "queue_joined");
    });
  }),

  test("room: une partie rejointe puis quittée (refresh) n'est pas supprimée", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await setupGame(server, 2);
      for (const p of players) p.ws.close();

      // Salle vide mais joueurs en delai de reconnexion : la partie reste
      await sleep(JOIN_TIMEOUT_MS + 300);
      assert(
        server.gameManager.getGame(gameId) !== undefined,
        "La partie doit attendre la reconnexion des joueurs",
      );
    });
  }),

  // ---------------- Fin de partie ranked par abandon ----------------

  test("ranked: après des abandons, le gagnant reste celui qui a fini premier", async () => {
    await withServer(async (server) => {
      const ids = ["alice", "bob", "charlie"].map((n) => uniqueUserId(n));
      const gameId = server.gameManager.createGame(
        ids.map((id) => ({ id, username: id })),
        GameMode.RANKED,
      )!;
      const game = server.gameManager.getGame(gameId)!;
      const [a, b, c] = await Promise.all(
        ids.map((id) => connectUser(server, id)),
      );
      for (const ws of [a, b, c]) {
        send(ws, { type: "join_game", gameId });
        await waitForMessage(ws, "game_updated");
      }

      // A pose sa derniere carte : classe 1er, la partie continue entre B et C
      game.topCard = { id: "top", color: "red", value: "5" };
      game.currentColor = "red";
      game.players[0].hand = [{ id: "last", color: "red", value: "3" }];
      send(a, { type: "play_card", gameId, cardId: "last" });
      await waitForMessage(c, "game_updated");
      assert(game.ranking[0] === ids[0], "A doit être classé premier");
      assert(game.status === GameStatus.IN_PROGRESS, "La partie continue");

      // B quitte : apres le delai de reconnexion, C reste seul
      const ended = waitForMessage(c, "game_ended", 8000);
      const elo = waitForMessage(c, "elo_updated", 8000);
      b.close();
      const endMsg = await ended;
      const eloMsg = await elo;

      assert(endMsg.winnerId === ids[0], "Le gagnant annoncé doit être A");
      const match = server.matches[0];
      assert(match?.winnerId === ids[0], "Le gagnant enregistré doit être A");
      assert(
        match.ranking[0] === ids[0] && match.ranking[1] === ids[2],
        `Classement attendu A puis C, reçu ${JSON.stringify(match.ranking)}`,
      );
      const gain = (id: string) => {
        const ch = eloMsg.changes.find((x: any) => x.userId === id);
        return ch.newElo - ch.oldElo;
      };
      assert(gain(ids[0]) > gain(ids[2]), "A doit gagner plus d'ELO que C");
      assert(gain(ids[2]) > gain(ids[1]), "C doit gagner plus d'ELO que B");
    });
  }),
];

// ============================================================
// RUNNER
// ============================================================

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.log(`  ⚠️  promesse rejetée non gérée : ${msg}`);
});

async function run() {
  // Import dynamique : les variables d'env doivent être posées avant le chargement
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
