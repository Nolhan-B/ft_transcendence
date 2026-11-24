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
const ALIVE_MS = 300;
const GRACE_MS = 500;
process.env.ALIVE_CHECK_MS = String(ALIVE_MS);
process.env.RECONNECT_GRACE_MS = String(GRACE_MS);

let gameGateway: any;

let passed = 0;
let failed = 0;

const JWT_SECRET = "test-secret";

let userCounter = 0;
function uniqueUserId(): string {
  userCounter++;
  return `ws_${Date.now()}_${userCounter}`;
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
      findUnique: async ({ where }: any) => ({
        id: where.id,
        username: `user_${where.id}`,
        elo: 1000,
      }),
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

  // ---------------- Deuxième onglet ----------------

  test("ws: deuxième onglet alors que le premier est vivant → refusé", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = openClient(server, userId);

      await waitFor(b, isError("Already connected"), "Already connected");
      await waitClosed(b);
      assert(
        !b.messages.some(isType("connected")),
        "Le deuxième onglet ne doit pas recevoir connected",
      );
      assert(
        a.ws.readyState === WebSocket.OPEN,
        "Le premier onglet doit rester ouvert",
      );
      a.ws.close();
    });
  }),

  test("ws: après un refus, le premier onglet fonctionne toujours", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      const b = openClient(server, userId);
      await waitClosed(b);

      send(a.ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "Toujours là",
      });
      await waitFor(a, isType("room_updated"), "room_updated sur A");
      a.ws.close();
    });
  }),

  test("ws: le refus d'un deuxième onglet ne retire pas le premier de la file", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const a = await connect(server, userId);
      send(a.ws, { type: "join_queue" });
      await waitFor(a, isType("queue_joined"), "queue_joined");

      const b = openClient(server, userId);
      await waitClosed(b);
      await sleep(100);

      assert(
        server.queueManager.has(userId),
        "A doit toujours être dans la file",
      );
      a.ws.close();
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
        !b.messages.some(isError("Already connected")),
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

  test("ws: ancien socket mort (ne répond plus au ping) → nouveau accepté", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      const dead = await connect(server, userId, { dead: true });

      const start = Date.now();
      const b = await connect(server, userId);
      const elapsed = Date.now() - start;

      assert(
        elapsed >= ALIVE_MS - 50,
        `Doit attendre le délai de ping (${elapsed} ms)`,
      );
      await waitClosed(dead);
      assert(b.ws.readyState === WebSocket.OPEN, "Le nouveau doit être ouvert");
      b.ws.close();
    });
  }),

  test("ws: après un ancien socket mort, un troisième onglet est refusé", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      await connect(server, userId, { dead: true });
      const b = await connect(server, userId);
      await sleep(100); // le close tardif de l'ancien est passé

      // Si le close de l'ancien avait effacé B, C serait accepté
      const c = openClient(server, userId);
      await waitFor(c, isError("Already connected"), "Already connected");
      b.ws.close();
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

  test("ws: le nouveau client abandonne pendant la vérification → le suivant est accepté", async () => {
    await withServer(async (server) => {
      const userId = uniqueUserId();
      await connect(server, userId, { dead: true });

      // B s'ouvre puis se ferme pendant que le serveur ping l'ancien
      const b = openClient(server, userId, { onOpen: (ws) => ws.close() });
      await waitClosed(b);
      await sleep(ALIVE_MS + 100);

      const c = await connect(server, userId);
      assert(c.ws.readyState === WebSocket.OPEN, "C doit être accepté");
      c.ws.close();
    });
  }),

  // ---------------- Messages pendant la vérification ----------------

  test("ws: un message envoyé pendant la vérification n'est pas perdu", async () => {
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
