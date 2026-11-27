import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";
import { QueueManager } from "../src/managers/queue.manager.js";

// Bots play fast in tests (the game default is 2.5 to 4.5 s)
process.env.BOT_MIN_DELAY_MS = "500";
process.env.BOT_EXTRA_DELAY_MS = "1000";

// Délais courts pour les tests : doivent être posés AVANT de charger le gateway
const HEARTBEAT_MS = 300;
const GRACE_MS = 500;
const SLOW_DB_MS = 300;
process.env.HEARTBEAT_MS = String(HEARTBEAT_MS);
process.env.RECONNECT_GRACE_MS = String(GRACE_MS);

let gameGateway: any;

let passed = 0;
let failed = 0;

const JWT_SECRET = "test-secret";

let userCounter = 0;
function uniqueUserId(prefix = "ws"): string {
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

// Un rejet oublié ne doit pas faire tomber toute la suite
process.on("unhandledRejection", (e) => {
  console.log("⚠️  rejet non géré :", e);
});

// ============================================================
// HELPERS
// ============================================================

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const gameManager = new GameManager();
  const roomManager = new RoomManager();
  const queueManager = new QueueManager();

  fastify.register(cookie);
  fastify.register(jwt, { secret: JWT_SECRET });

  fastify.decorate("prisma", {
    match: { create: async () => ({}) },
    user: {
      // "revoked_..." : session revoquee (tokenVersion 1, les tokens de test
      // sont en version 0). "slow_..." : la base met 300 ms a repondre, pour
      // tester ce qui arrive pendant la verification de session.
      findUnique: async ({ where }: any) => {
        if (where.id.startsWith("slow")) await sleep(SLOW_DB_MS);
        return {
          id: where.id,
          username: `user_${where.id}`,
          elo: 1000,
          tokenVersion: where.id.startsWith("revoked") ? 1 : 0,
        };
      },
      findMany: async () => [],
      update: async () => ({}),
    },
    $transaction: async () => [],
  } as any);

  fastify.decorate("gameManager", gameManager);
  fastify.decorate("roomManager", roomManager);
  fastify.decorate("queueManager", queueManager);

  fastify.register(websocket);
  fastify.register(gameGateway);

  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const address = fastify.server.address();
  const port = typeof address === "object" ? address!.port : 0;

  return { fastify, port, gameManager, roomManager, queueManager };
}

type Server = Awaited<ReturnType<typeof buildServer>>;

// Client qui garde tous les messages reçus depuis l'ouverture
type Client = {
  ws: WebSocket;
  messages: any[];
  closeCode: number | null;
};

// dead = true : le client ne répond plus aux pings (onglet figé, wifi coupé)
function openClient(
  server: Server,
  userId: string,
  opts: {
    dead?: boolean;
    token?: string;
    onOpen?: (ws: WebSocket) => void;
  } = {},
): Client {
  const token = opts.token ?? server.fastify.jwt.sign({ id: userId });
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
    headers: { Cookie: `access_token=${token}` },
    autoPong: !opts.dead,
  } as any);
  // Filet pour les vieilles versions de ws qui ignorent autoPong
  if (opts.dead) (ws as any).pong = () => {};

  const client: Client = { ws, messages: [], closeCode: null };
  ws.on("message", (data) => client.messages.push(JSON.parse(data.toString())));
  ws.on("close", (code) => (client.closeCode = code));
  ws.on("error", () => {});
  if (opts.onOpen) ws.on("open", () => opts.onOpen!(ws));
  return client;
}

// Attend un message qui vérifie le prédicat (déjà reçu ou à venir)
async function waitFor(
  client: Client,
  pred: (m: any) => boolean,
  label: string,
  timeoutMs = 3000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = client.messages.find(pred);
    if (found) return found;
    await sleep(20);
  }
  throw new Error(
    `Timeout en attendant ${label}, reçu : ${JSON.stringify(client.messages)}`,
  );
}

const isType = (type: string) => (m: any) => m.type === type;
const isError = (text: string) => (m: any) =>
  m.type === "error" && JSON.stringify(m).includes(text);

async function waitClosed(client: Client, timeoutMs = 3000) {
  const start = Date.now();
  while (client.closeCode === null && Date.now() - start < timeoutMs) {
    await sleep(20);
  }
  assert(client.closeCode !== null, "Le socket devait être fermé");
}

async function connect(server: Server, userId: string, opts = {}) {
  const client = openClient(server, userId, opts);
  await waitFor(client, isType("connected"), "connected");
  return client;
}

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
}

async function withServer(fn: (server: Server) => Promise<void>) {
  const server = await buildServer();
  const clients: WebSocket[] = [];
  try {
    await fn(server);
  } finally {
    for (const ws of clients) ws.terminate();
    await sleep(50);
    await server.fastify.close();
  }
}

// Partie humain contre bot, déjà rejointe
async function startGameWithBot(client: Client): Promise<string> {
  send(client.ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers: 2,
    name: "Session Room",
  });
  const created = await waitFor(client, isType("room_updated"), "room_updated");
  const roomCode = created.room.code;

  const before = client.messages.length;
  send(client.ws, { type: "add_bot", roomCode });
  await waitFor(
    client,
    (m) => m.type === "room_updated" && client.messages.indexOf(m) >= before,
    "room_updated après add_bot",
  );

  send(client.ws, { type: "start_game", roomCode });
  const started = await waitFor(client, isType("game_started"), "game_started");

  send(client.ws, { type: "join_game", gameId: started.gameId });
  await waitFor(client, isType("game_updated"), "game_updated");
  return started.gameId;
}

// Cree une room et renvoie son code
async function createRoom(client: Client, name = "Room", maxPlayers = 3) {
  const before = client.messages.length;
  send(client.ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers,
    name,
  });
  const msg = await waitFor(
    client,
    (m) =>
      m.type === "room_updated" &&
      m.room.name === name &&
      client.messages.indexOf(m) >= before,
    `room_updated ${name}`,
  );
  return msg.room.code as string;
}

const inRoom = (server: Server, code: string, userId: string) =>
  !!server.roomManager.getRoom(code)?.players.some((p) => p.id === userId);

// ============================================================
// TESTS
// ============================================================

const tests = [
  // ---------------- Connexion de base ----------------

  test("ws: première connexion → connected", async () => {
    await withServer(async (server) => {
      const a = await connect(server, uniqueUserId());
      assert(
        a.ws.readyState === WebSocket.OPEN,
        "Le socket doit rester ouvert",
      );
      a.ws.close();
    });
  }),

  test("ws: sans cookie → Unauthorized et fermeture", async () => {
    await withServer(async (server) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      const client: Client = { ws, messages: [], closeCode: null };
      ws.on("message", (d) => client.messages.push(JSON.parse(d.toString())));
      ws.on("close", (c) => (client.closeCode = c));
      ws.on("error", () => {});
      await waitFor(client, isError("Unauthorized"), "Unauthorized");
      await waitClosed(client);
    });
  }),

  test("ws: token invalide → Invalid token et fermeture", async () => {
    await withServer(async (server) => {
      const c = openClient(server, "x", { token: "nimportequoi" });
      await waitFor(c, isError("Invalid token"), "Invalid token");
      await waitClosed(c);
      assert(
        !c.messages.some(isType("connected")),
        "Ne doit jamais recevoir connected",
      );
    });
  }),

  // ---------------- Plusieurs onglets ----------------

  test("ws: deuxième onglet alors que le premier est vivant → accepté", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = await connect(server, userId);
      await sleep(100);
      assert(
        a.ws.readyState === WebSocket.OPEN,
        "Le premier doit rester ouvert",
      );
      assert(
        b.ws.readyState === WebSocket.OPEN,
        "Le deuxième doit être ouvert",
      );
      assert(
        !a.messages.some(isType("error")) && !b.messages.some(isType("error")),
        "Aucune erreur sur les deux onglets",
      );
      a.ws.close();
      b.ws.close();
    });
  }),

  test("ws: trois onglets → chacun peut agir", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const tabs = [
        await connect(server, userId),
        await connect(server, userId),
        await connect(server, userId),
      ];
      for (const [i, tab] of tabs.entries()) {
        send(tab.ws, {
          type: "create_room",
          mode: GameMode.CLASSIC,
          maxPlayers: 2,
          name: `Onglet ${i}`,
        });
        await waitFor(tab, isType("room_updated"), `room_updated onglet ${i}`);
      }
      for (const tab of tabs) tab.ws.close();
    });
  }),

  test("ws: fermer un onglet ne retire pas le joueur de la file", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      send(a.ws, { type: "join_queue" });
      await waitFor(a, isType("queue_joined"), "queue_joined");

      const b = await connect(server, userId);
      b.ws.close();
      await waitClosed(b);
      await sleep(100);
      assert(
        server.queueManager.has(userId),
        "A doit toujours être dans la file",
      );

      a.ws.close();
      await waitClosed(a);
      await sleep(100);
      assert(
        !server.queueManager.has(userId),
        "Le dernier onglet fermé : le joueur quitte la file",
      );
    });
  }),

  test("ws: deux onglets dans la même partie → les deux reçoivent l'état", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const gameId = await startGameWithBot(a);

      const b = await connect(server, userId);
      send(b.ws, { type: "join_game", gameId });
      await waitFor(b, isType("game_updated"), "game_updated sur B");

      // Le bot ou le timer finit par jouer : les deux onglets le voient
      const beforeA = a.messages.length;
      const beforeB = b.messages.length;
      const game = server.gameManager.getGame(gameId)!;
      const me = game.players.find((p) => p.userId === userId)!;
      if (me.isCurrentTurn) send(a.ws, { type: "draw_card", gameId });
      const fresh = (c: Client, before: number) => (m: any) =>
        m.type === "game_updated" && c.messages.indexOf(m) >= before;
      await waitFor(a, fresh(a, beforeA), "nouvel état sur A", 8000);
      await waitFor(b, fresh(b, beforeB), "nouvel état sur B", 8000);
      a.ws.close();
      b.ws.close();
    });
  }),

  test("ws: fermer un onglet en pleine partie → l'autre garde la place", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const gameId = await startGameWithBot(a);
      const b = await connect(server, userId);
      send(b.ws, { type: "join_game", gameId });
      await waitFor(b, isType("game_updated"), "game_updated sur B");

      a.ws.close();
      await sleep(GRACE_MS + 300);
      const game = server.gameManager.getGame(gameId);
      assert(
        game?.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer",
      );
      const me = game!.players.find((p) => p.userId === userId)!;
      assert(!me.disconnected, "Le joueur ne doit pas être marqué déconnecté");
      b.ws.close();
    });
  }),

  test("ws: deux joueurs différents → tous les deux acceptés", async () => {
    await withServer(async (server) => {
      const a = await connect(server, uniqueUserId());
      const b = await connect(server, uniqueUserId());
      assert(a.ws.readyState === WebSocket.OPEN, "A ouvert");
      assert(b.ws.readyState === WebSocket.OPEN, "B ouvert");
      a.ws.close();
      b.ws.close();
    });
  }),

  // ---------------- Refresh ----------------

  test("ws: refresh (close puis reconnexion immédiate) → accepté", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      a.ws.close(); // pas d'attente : le serveur n'a peut-être pas encore traité le close
      const b = await connect(server, userId);
      assert(
        !b.messages.some(isType("error")),
        "Le refresh ne doit pas être refusé",
      );
      b.ws.close();
    });
  }),

  test("ws: dix refresh d'affilée → tous acceptés", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      let current = await connect(server, userId);
      for (let i = 0; i < 10; i++) {
        current.ws.close();
        current = await connect(server, userId);
      }
      assert(
        current.ws.readyState === WebSocket.OPEN,
        "Le dernier doit être ouvert",
      );
      current.ws.close();
    });
  }),

  test("ws: dix chargements sans fermer les anciens → tous acceptés", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const tabs: Client[] = [];
      for (let i = 0; i < 10; i++) tabs.push(await connect(server, userId));
      assert(
        tabs.every((t) => t.ws.readyState === WebSocket.OPEN),
        "Tous doivent être ouverts",
      );
      for (const t of tabs) t.ws.close();
    });
  }),

  test("ws: socket mort (ne répond plus au ping) → coupé par le heartbeat", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const dead = await connect(server, userId, { dead: true });

      const start = Date.now();
      const b = await connect(server, userId);
      assert(
        Date.now() - start < HEARTBEAT_MS,
        "Le nouveau est accepté sans attendre",
      );
      await waitClosed(dead);
      assert(
        b.ws.readyState === WebSocket.OPEN,
        "Le nouveau doit rester ouvert",
      );
      b.ws.close();
    });
  }),

  test("ws: un socket qui répond aux pings reste ouvert", async () => {
    await withServer(async (server) => {
      const a = await connect(server, uniqueUserId());
      await sleep(HEARTBEAT_MS * 4);
      assert(
        a.ws.readyState === WebSocket.OPEN,
        "Le socket vivant doit rester ouvert",
      );
      a.ws.close();
    });
  }),

  test("ws: le close tardif de l'ancien socket ne retire pas le nouveau de la file", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const dead = await connect(server, userId, { dead: true });
      const b = await connect(server, userId);

      send(b.ws, { type: "join_queue" });
      await waitFor(b, isType("queue_joined"), "queue_joined");
      await waitClosed(dead);
      await sleep(100);

      assert(server.queueManager.has(userId), "B doit rester dans la file");
      b.ws.close();
    });
  }),

  test("ws: un client qui se ferme tout de suite → le suivant est accepté", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const b = openClient(server, userId, { onOpen: (ws) => ws.close() });
      await waitClosed(b);

      const c = await connect(server, userId);
      assert(c.ws.readyState === WebSocket.OPEN, "C doit être accepté");
      c.ws.close();
    });
  }),

  // ---------------- Session ----------------

  test("ws: session révoquée → Invalid token, jamais connected", async () => {
    await withServer(async (server) => {
      const c = openClient(server, uniqueUserId("revoked"));
      await waitFor(c, isError("Invalid token"), "Invalid token");
      await waitClosed(c);
      assert(
        !c.messages.some(isType("connected")),
        "Ne doit jamais recevoir connected",
      );
    });
  }),

  test("ws: session à jour (v = tokenVersion) → acceptée", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId("revoked");
      const token = server.fastify.jwt.sign({ id: userId, v: 1 });
      const c = await connect(server, userId, { token });
      assert(c.ws.readyState === WebSocket.OPEN, "Doit être ouvert");
      c.ws.close();
    });
  }),

  test("ws: messages envoyés pendant la vérification de session → traités dans l'ordre", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId("slow");
      const b = openClient(server, userId, {
        onOpen: (ws) => {
          send(ws, { type: "join_queue" });
          send(ws, { type: "leave_queue" });
        },
      });
      await waitFor(b, isType("queue_left"), "queue_left");
      const connected = b.messages.findIndex(isType("connected"));
      const joined = b.messages.findIndex(isType("queue_joined"));
      const left = b.messages.findIndex(isType("queue_left"));
      assert(connected !== -1 && connected < joined, "connected d'abord");
      assert(joined < left, "queue_joined avant queue_left");
      assert(!b.messages.some(isType("error")), "Aucune erreur");
      b.ws.close();
    });
  }),

  test("ws: onglet fermé pendant la vérification → ne garde pas le joueur dans la file", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId("slow");
      // A se ferme avant la fin de la vérification de session
      const a = openClient(server, userId, { onOpen: (ws) => ws.close() });
      await waitClosed(a);
      await sleep(SLOW_DB_MS + 100);

      const b = await connect(server, userId);
      send(b.ws, { type: "join_queue" });
      await waitFor(b, isType("queue_joined"), "queue_joined");
      b.ws.close();
      await waitClosed(b);
      await sleep(100);
      // Si A etait reste dans les sockets du joueur, B ne serait pas le dernier
      assert(
        !server.queueManager.has(userId),
        "Le joueur doit avoir quitté la file",
      );
    });
  }),

  // ---------------- Anti-flood ----------------

  test("ws: flood de 300 messages → l'excédent est refusé, le socket reste utilisable", async () => {
    await withServer(async (server) => {
      const c = await connect(server, uniqueUserId());
      for (let i = 0; i < 300; i++) send(c.ws, { type: "leave_queue" });
      await sleep(500);
      const limited = c.messages.filter(isError("Too many messages")).length;
      assert(limited >= 50, `Au moins 50 refus attendus, ${limited} reçus`);
      assert(limited <= 120, `La rafale de 200 doit passer, ${limited} refus`);
      assert(c.ws.readyState === WebSocket.OPEN, "Le socket reste ouvert");

      // Une seconde plus tard, le seau s'est rempli : une vraie action passe
      await sleep(1000);
      send(c.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "Après le flood",
      });
      await waitFor(c, isType("room_updated"), "room_updated après le flood");
      c.ws.close();
    });
  }),

  test("ws: la limite est par socket → un autre onglet n'est pas bloqué", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = await connect(server, userId);
      for (let i = 0; i < 300; i++) send(a.ws, { type: "leave_queue" });
      await sleep(300);
      send(b.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "Onglet calme",
      });
      await waitFor(b, isType("room_updated"), "room_updated sur B");
      assert(
        !b.messages.some(isError("Too many messages")),
        "B ne doit pas être limité",
      );
      a.ws.close();
      b.ws.close();
    });
  }),

  // ---------------- Rooms et onglets ----------------

  test("ws: leave_room depuis un onglet → tous les onglets quittent la room", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Onglets",
      });
      const roomCode = (
        await waitFor(host, isType("room_updated"), "room_updated")
      ).room.code;

      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = await connect(server, userId);
      send(a.ws, { type: "join_room", roomCode });
      await waitFor(a, isType("room_updated"), "room_updated sur A");
      send(b.ws, { type: "join_room", roomCode });
      await waitFor(b, isType("room_updated"), "room_updated sur B");

      send(a.ws, { type: "leave_room", roomCode });
      await sleep(200);
      const room = server.roomManager.getRoom(roomCode)!;
      assert(
        !JSON.stringify(room).includes(userId),
        "Le joueur ne doit plus être dans la room",
      );

      // B ne suit plus la room : il ne reçoit pas ses mises à jour suivantes
      const before = b.messages.length;
      const other = await connect(server, uniqueUserId());
      send(other.ws, { type: "join_room", roomCode });
      await waitFor(
        host,
        (m) => m.type === "room_updated" && m.room.players.length === 2,
        "room_updated avec other",
      );
      await sleep(200);
      assert(
        !b.messages.slice(before).some(isType("room_updated")),
        "B ne doit plus recevoir les mises à jour de la room",
      );
      for (const c of [host, a, b, other]) c.ws.close();
    });
  }),

  test("ws: fermer un des deux onglets d'une room → le joueur y reste", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Lobby",
      });
      const roomCode = (
        await waitFor(host, isType("room_updated"), "room_updated")
      ).room.code;

      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = await connect(server, userId);
      send(a.ws, { type: "join_room", roomCode });
      await waitFor(a, isType("room_updated"), "room_updated sur A");
      send(b.ws, { type: "join_room", roomCode });
      await waitFor(b, isType("room_updated"), "room_updated sur B");

      a.ws.close();
      await waitClosed(a);
      await sleep(200);
      assert(
        JSON.stringify(server.roomManager.getRoom(roomCode)).includes(userId),
        "Le joueur doit rester dans la room",
      );
      b.ws.close();
      await waitClosed(b);
      await sleep(200);
      assert(
        !JSON.stringify(server.roomManager.getRoom(roomCode)).includes(userId),
        "Dernier onglet fermé : le joueur quitte la room",
      );
      host.ws.close();
    });
  }),

  // ---------------- Une chose a la fois ----------------

  test("lobby: créer une 2e room quitte la 1re", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const first = await createRoom(a, "Première");
      const second = await createRoom(a, "Deuxième");
      assert(!inRoom(server, first, userId), "Plus dans la 1re room");
      assert(inRoom(server, second, userId), "Dans la 2e room");
      assert(
        !server.roomManager.getRoom(first),
        "La 1re room, vide, est supprimée",
      );
      await waitFor(
        a,
        (m) => m.type === "room_left" && m.roomCode === first,
        "room_left",
      );
      a.ws.close();
    });
  }),

  test("lobby: rejoindre une autre room quitte la sienne, les autres le voient", async () => {
    await withServer(async (server) => {
      const host1 = await connect(server, uniqueUserId());
      const host2 = await connect(server, uniqueUserId());
      const room1 = await createRoom(host1, "Room 1");
      const room2 = await createRoom(host2, "Room 2");
      const userId = uniqueUserId();
      const p = await connect(server, userId);
      send(p.ws, { type: "join_room", roomCode: room1 });
      await waitFor(
        host1,
        (m) => m.type === "room_updated" && m.room.players.length === 2,
        "P dans room 1",
      );

      send(p.ws, { type: "join_room", roomCode: room2 });
      await waitFor(
        host2,
        (m) => m.type === "room_updated" && m.room.players.length === 2,
        "P dans room 2",
      );
      await waitFor(
        host1,
        (m) => m.type === "room_updated" && m.room.players.length === 1,
        "room 1 mise à jour sans P",
      );
      assert(!inRoom(server, room1, userId), "Plus dans la room 1");
      assert(inRoom(server, room2, userId), "Dans la room 2");
      for (const c of [host1, host2, p]) c.ws.close();
    });
  }),

  test("lobby: mauvais mot de passe ou room disparue → garde sa room", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      const code = server.roomManager.createRoom(
        "someone",
        "someone",
        GameMode.CLASSIC,
        3,
        "Privée",
        "secret",
      );
      void host;
      const userId = uniqueUserId();
      const p = await connect(server, userId);
      const mine = await createRoom(p, "La mienne");

      send(p.ws, { type: "join_room", roomCode: code, password: "faux" });
      await waitFor(
        p,
        isError("Password is incorrect"),
        "Password is incorrect",
      );
      send(p.ws, { type: "join_room", roomCode: "ZZZZZZ" });
      await waitFor(p, isError("Room not found"), "Room not found");
      await sleep(100);
      assert(inRoom(server, mine, userId), "Doit rester dans sa room");
      assert(!p.messages.some(isType("room_left")), "Aucun room_left");
      host.ws.close();
      p.ws.close();
    });
  }),

  test("lobby: créer ou rejoindre une room en jouant → Already in a game", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      const other = await createRoom(host, "Autre");
      const userId = uniqueUserId();
      const p = await connect(server, userId);
      await startGameWithBot(p);
      const roomsBefore = server.roomManager.listRooms().length;

      send(p.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "Pendant",
      });
      await waitFor(p, isError("Already in a game"), "create refusé");
      send(p.ws, { type: "join_room", roomCode: other });
      await sleep(100);
      assert(
        p.messages.filter(isError("Already in a game")).length === 2,
        "join refusé aussi",
      );
      assert(
        server.roomManager.listRooms().length === roomsBefore,
        "Aucune room créée",
      );
      assert(!inRoom(server, other, userId), "Pas entré dans l'autre room");
      host.ws.close();
      p.ws.close();
    });
  }),

  test("lobby: un 2e onglet ne peut pas lancer une 2e partie", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      await startGameWithBot(a);
      const b = await connect(server, userId);
      send(b.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "Onglet B",
      });
      await waitFor(
        b,
        isError("Already in a game"),
        "refusé dans l'autre onglet",
      );
      a.ws.close();
      b.ws.close();
    });
  }),

  test("lobby: start_game refusé si un joueur de la room joue déjà", async () => {
    await withServer(async (server) => {
      const playerId = uniqueUserId();
      const p = await connect(server, playerId);
      await startGameWithBot(p);
      const host = await connect(server, uniqueUserId());
      const code = await createRoom(host, "Avec un joueur occupé");
      // Il ne peut plus y entrer par le socket : on l'y met directement
      server.roomManager.joinRoom(code, playerId, `user_${playerId}`);
      send(host.ws, { type: "start_game", roomCode: code });
      await waitFor(host, isError("is already in a game"), "start refusé");
      assert(
        !host.messages.some(isType("game_started")),
        "Aucune partie lancée",
      );
      host.ws.close();
      p.ws.close();
    });
  }),

  test("lobby: partie quittée (socket fermé) → peut recréer une room", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      await startGameWithBot(a);
      a.ws.close();
      await waitClosed(a);
      await sleep(50);
      const b = await connect(server, userId);
      const code = await createRoom(b, "Après");
      assert(inRoom(server, code, userId), "Room créée");
      b.ws.close();
    });
  }),

  test("lobby: rejoindre la file quitte la room", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const code = await createRoom(a, "Avant la file");
      send(a.ws, { type: "join_queue" });
      await waitFor(a, isType("queue_joined"), "queue_joined");
      await waitFor(
        a,
        (m) => m.type === "room_left" && m.roomCode === code,
        "room_left",
      );
      assert(!inRoom(server, code, userId), "Plus dans la room");
      assert(server.queueManager.has(userId), "Dans la file");
      a.ws.close();
    });
  }),

  test("lobby: créer une room quitte la file", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      send(a.ws, { type: "join_queue" });
      await waitFor(a, isType("queue_joined"), "queue_joined");
      await createRoom(a, "Après la file");
      await waitFor(a, isType("queue_left"), "queue_left");
      assert(!server.queueManager.has(userId), "Plus dans la file");
      a.ws.close();
    });
  }),

  test("lobby: leave_room → room_left sur tous les onglets", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      const code = await createRoom(host, "Onglets");
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = await connect(server, userId);
      send(a.ws, { type: "join_room", roomCode: code });
      await waitFor(a, isType("room_updated"), "A dans la room");
      send(b.ws, { type: "join_room", roomCode: code });
      await waitFor(b, isType("room_updated"), "B dans la room");
      send(a.ws, { type: "leave_room", roomCode: code });
      await waitFor(a, isType("room_left"), "room_left sur A");
      await waitFor(b, isType("room_left"), "room_left sur B");
      for (const c of [host, a, b]) c.ws.close();
    });
  }),

  // ---------------- Invitations ----------------

  test("invite: un invité entre dans une room à mot de passe sans le mot de passe", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Privée",
        password: "secret",
      });
      const code = (await waitFor(host, isType("room_updated"), "room_updated"))
        .room.code;
      const friendId = uniqueUserId();
      const friend = await connect(server, friendId);

      send(host.ws, {
        type: "invite_to_room",
        roomCode: code,
        userId: friendId,
      });
      await sleep(100);
      assert(!host.messages.some(isType("error")), "L'invitation doit passer");
      send(friend.ws, { type: "join_room", roomCode: code });
      await waitFor(
        friend,
        isType("room_updated"),
        "room_updated pour l'invité",
      );
      assert(inRoom(server, code, friendId), "L'invité est dans la room");
      host.ws.close();
      friend.ws.close();
    });
  }),

  test("invite: sans invitation, le mot de passe est toujours demandé", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Privée",
        password: "secret",
      });
      const code = (await waitFor(host, isType("room_updated"), "room_updated"))
        .room.code;
      send(host.ws, {
        type: "invite_to_room",
        roomCode: code,
        userId: uniqueUserId(),
      });
      const strangerId = uniqueUserId();
      const stranger = await connect(server, strangerId);
      send(stranger.ws, { type: "join_room", roomCode: code });
      await waitFor(
        stranger,
        isError("Password is incorrect"),
        "Password is incorrect",
      );
      assert(!inRoom(server, code, strangerId), "Pas entré");
      host.ws.close();
      stranger.ws.close();
    });
  }),

  test("invite: seul un membre de la room peut inviter", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Privée",
        password: "secret",
      });
      const code = (await waitFor(host, isType("room_updated"), "room_updated"))
        .room.code;
      const outsider = await connect(server, uniqueUserId());
      const meId = uniqueUserId();
      send(outsider.ws, {
        type: "invite_to_room",
        roomCode: code,
        userId: meId,
      });
      await waitFor(outsider, isError("You are not in this room"), "refus");
      const me = await connect(server, meId);
      send(me.ws, { type: "join_room", roomCode: code });
      await waitFor(
        me,
        isError("Password is incorrect"),
        "l'invitation n'a pas compté",
      );
      for (const c of [host, outsider, me]) c.ws.close();
    });
  }),

  test("invite: room inconnue ou message incomplet → erreur", async () => {
    await withServer(async (server) => {
      const a = await connect(server, uniqueUserId());
      send(a.ws, { type: "invite_to_room", roomCode: "ZZZZZZ", userId: "x" });
      await waitFor(a, isError("Room not found"), "Room not found");
      send(a.ws, { type: "invite_to_room", roomCode: "ZZZZZZ" });
      await waitFor(
        a,
        isError("Invalid message format"),
        "Invalid message format",
      );
      a.ws.close();
    });
  }),

  // ---------------- Messages envoyés dès l'ouverture ----------------

  test("ws: un message envoyé dès l'ouverture n'est pas perdu", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      await connect(server, userId, { dead: true });

      // Le message part dès l'ouverture, avant même connected
      const b = openClient(server, userId, {
        onOpen: (ws) =>
          send(ws, {
            type: "create_room",
            mode: GameMode.CLASSIC,
            maxPlayers: 2,
            name: "Envoyé tôt",
          }),
      });

      await waitFor(b, isType("connected"), "connected");
      const room = await waitFor(b, isType("room_updated"), "room_updated");
      assert(room.room.name === "Envoyé tôt", "La room doit avoir été créée");
      b.ws.close();
    });
  }),

  test("ws: plusieurs messages envoyés tôt sont traités dans l'ordre", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      await connect(server, userId, { dead: true });

      const b = openClient(server, userId, {
        onOpen: (ws) => {
          send(ws, { type: "join_queue" });
          send(ws, { type: "leave_queue" });
        },
      });

      await waitFor(b, isType("queue_left"), "queue_left");
      const joined = b.messages.findIndex(isType("queue_joined"));
      const left = b.messages.findIndex(isType("queue_left"));
      assert(
        joined !== -1 && joined < left,
        "queue_joined doit arriver avant queue_left",
      );
      assert(
        !server.queueManager.has(userId),
        "Le joueur ne doit plus être dans la file",
      );
      b.ws.close();
    });
  }),

  // ---------------- Refresh en pleine partie ----------------

  test("ws: refresh en pleine partie → le joueur reprend sa place", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const gameId = await startGameWithBot(a);

      a.ws.close();
      const b = await connect(server, userId);
      send(b.ws, { type: "join_game", gameId });
      await waitFor(b, isType("game_updated"), "game_updated après refresh");

      await sleep(GRACE_MS + 300);
      const game = server.gameManager.getGame(gameId);
      assert(
        game?.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer",
      );
      const me = game!.players.find((p) => p.userId === userId)!;
      assert(!me.disconnected, "Le joueur ne doit pas être marqué déconnecté");
      b.ws.close();
    });
  }),

  test("ws: refresh dans un lobby → le joueur reste dans la room", async () => {
    await withServer(async (server) => {
      const host = await connect(server, uniqueUserId());
      send(host.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 3,
        name: "Lobby",
      });
      const created = await waitFor(
        host,
        isType("room_updated"),
        "room_updated",
      );
      const roomCode = created.room.code;

      const userId = uniqueUserId();
      const a = await connect(server, userId, { dead: true });
      send(a.ws, { type: "join_room", roomCode });
      await waitFor(a, isType("room_updated"), "room_updated sur A");

      // B rejoint dès l'ouverture, pendant que l'ancien socket se fait tuer
      const b = openClient(server, userId, {
        onOpen: (ws) => send(ws, { type: "join_room", roomCode }),
      });
      await waitFor(b, isType("connected"), "connected");
      await waitClosed(a);
      await sleep(200);

      const room = server.roomManager.getRoom(roomCode);
      assert(room !== undefined, "La room doit exister");
      assert(
        JSON.stringify(room).includes(userId),
        "Le joueur doit toujours être dans la room",
      );
      host.ws.close();
      b.ws.close();
    });
  }),

  test("ws: socket mort en pleine partie → le nouveau reprend la partie", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId, { dead: true });
      const gameId = await startGameWithBot(a);

      const b = await connect(server, userId);
      send(b.ws, { type: "join_game", gameId });
      await waitFor(b, isType("game_updated"), "game_updated");

      await sleep(GRACE_MS + 300);
      const game = server.gameManager.getGame(gameId);
      assert(
        game?.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer",
      );
      const me = game!.players.find((p) => p.userId === userId)!;
      assert(!me.disconnected, "Le joueur ne doit pas être marqué déconnecté");
      b.ws.close();
    });
  }),

  test("ws: join_game envoyé dès l'ouverture après refresh → reçoit l'état", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId, { dead: true });
      const gameId = await startGameWithBot(a);

      const b = openClient(server, userId, {
        onOpen: (ws) => send(ws, { type: "join_game", gameId }),
      });
      await waitFor(b, isType("game_updated"), "game_updated");
      b.ws.close();
    });
  }),
];

// ============================================================
// RUNNER
// ============================================================

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
