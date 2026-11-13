import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";
import { QueueManager } from "../src/managers/queue.manager.js";
import { isValidPlay } from "../src/engine/rules.js";

// Délais courts pour les tests : doivent être définis AVANT de charger le gateway
const TICK_MS = 100;
const JOIN_TIMEOUT_MS = 500;
const GRACE_MS = 300;
process.env.MATCHMAKING_TICK_MS = String(TICK_MS);
process.env.MATCH_JOIN_TIMEOUT_MS = String(JOIN_TIMEOUT_MS);
process.env.RECONNECT_GRACE_MS = String(GRACE_MS);

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
// FAUSSE BASE DE DONNÉES
// ============================================================

// Stocke vraiment les utilisateurs et les matchs, pour vérifier les ELO
function createDb() {
  const users = new Map<
    string,
    { id: string; username: string; elo: number }
  >();
  const matches: any[] = [];

  function ensure(id: string) {
    if (!users.has(id))
      users.set(id, { id, username: `user_${id}`, elo: 1000 });
    return users.get(id)!;
  }

  const prisma = {
    user: {
      findUnique: async ({ where }: any) => {
        // Les ids "ghost_..." simulent un utilisateur supprimé de la base
        if (where.id.startsWith("ghost")) return null;
        return { ...ensure(where.id) };
      },
      findMany: async ({ where }: any) =>
        (where.id.in as string[])
          .filter((id) => users.has(id))
          .map((id) => ({ id, elo: users.get(id)!.elo })),
      update: async ({ where, data }: any) => {
        const u = ensure(where.id);
        Object.assign(u, data);
        return { ...u };
      },
    },
    match: {
      create: async ({ data }: any) => {
        matches.push(data);
        return data;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return {
    prisma,
    users,
    matches,
    setElo(id: string, elo: number) {
      ensure(id).elo = elo;
    },
    elo(id: string) {
      return ensure(id).elo;
    },
  };
}

// ============================================================
// HELPERS
// ============================================================

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const gameManager = new GameManager();
  const roomManager = new RoomManager();
  const queueManager = new QueueManager();
  const db = createDb();
  const sockets: WebSocket[] = [];

  fastify.register(cookie);
  fastify.register(jwt, { secret: JWT_SECRET });

  fastify.decorate("prisma", db.prisma as any);
  fastify.decorate("gameManager", gameManager);
  fastify.decorate("roomManager", roomManager);
  fastify.decorate("queueManager", queueManager);

  fastify.register(websocket);
  fastify.register(gameGateway);

  await fastify.listen({ port: 0, host: "127.0.0.1" });
  const address = fastify.server.address();
  const port = typeof address === "object" ? address!.port : 0;

  return { fastify, port, gameManager, roomManager, queueManager, db, sockets };
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

// failOnError : rejette dès qu'une erreur arrive. À désactiver pour les attentes
// longues (fin de partie, ELO), qui ne doivent pas échouer sur un coup refusé.
function waitForMessage(
  ws: WebSocket,
  type: string,
  timeoutMs = 5000,
  failOnError = true,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`Timeout waiting for "${type}"`));
    }, timeoutMs);
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (failOnError && msg.type === "error" && type !== "error") {
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

// Collecte tous les messages reçus pendant `ms` millisecondes
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

async function closeWs(ws: WebSocket) {
  ws.close();
  await sleep(100);
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

interface Player {
  id: string;
  ws: WebSocket;
}

// Connecte un joueur, lui donne un ELO et le met dans la file
async function queuePlayer(server: Server, elo = 1000): Promise<Player> {
  const id = uniqueUserId();
  server.db.setElo(id, elo);
  const ws = await connectUser(server, id);
  send(ws, { type: "join_queue" });
  await waitForMessage(ws, "queue_joined");
  return { id, ws };
}

// Met plusieurs joueurs dans la file et attend qu'ils reçoivent tous match_found
async function queueAndMatch(server: Server, elos: number[]) {
  const players: Player[] = [];
  for (const elo of elos) players.push(await queuePlayer(server, elo));
  const found = await Promise.all(
    players.map((p) => waitForMessage(p.ws, "match_found", 3000)),
  );
  return { players, found, gameId: found[0].gameId as string };
}

// Fait rejoindre la partie à tous les joueurs
async function joinAll(players: Player[], gameId: string) {
  for (const p of players) {
    send(p.ws, { type: "join_game", gameId });
    await waitForMessage(p.ws, "game_updated");
  }
}

// Attend le prochain game_updated ou la prochaine erreur sur ce socket
function nextUpdateOrError(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error("Timeout waiting for game_updated"));
    }, timeoutMs);
    const handler = (data: any) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "game_updated" || msg.type === "error") {
        clearTimeout(timeout);
        ws.off("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

// Joue la partie jusqu'au bout : chaque joueur pose la première carte que le moteur
// accepte (même règle que le serveur), sinon pioche. Si un coup est refusé, il pioche.
async function playToEnd(server: Server, players: Player[], gameId: string) {
  const byId = new Map(players.map((p) => [p.id, p.ws]));
  for (let turn = 0; turn < 3000; turn++) {
    const game = server.gameManager.getGame(gameId);
    if (!game || game.status === GameStatus.FINISHED) return;

    const current = game.players.find((p) => p.isCurrentTurn);
    if (!current) return;
    const ws = byId.get(current.userId)!;

    const card = current.hand.find((c) =>
      isValidPlay(
        c,
        game.topCard,
        game.currentColor,
        game.pendingDrawCount,
        game.settings.stacking,
      ),
    );

    let reply: any;
    if (card) {
      const response = nextUpdateOrError(ws);
      send(ws, {
        type: "play_card",
        gameId,
        cardId: card.id,
        ...(card.color === "wild" ? { chosenColor: "red" } : {}),
      });
      reply = await response;
    }

    if (!card || reply?.type === "error") {
      const response = nextUpdateOrError(ws);
      send(ws, { type: "draw_card", gameId });
      const drawReply = await response;
      if (drawReply.type === "error") {
        throw new Error(
          `Pioche refusée pour ${current.userId} : ${drawReply.message}`,
        );
      }
    }
  }
  throw new Error("La partie ne s'est pas terminée en 3000 coups");
}

// ============================================================
// TESTS
// ============================================================

const tests = [
  // ---------------- Entrée et sortie de la file ----------------

  test("queue: join_queue répond queue_joined avec l'ELO du joueur", async () => {
    await withServer(async (server) => {
      const id = uniqueUserId();
      server.db.setElo(id, 1337);
      const ws = await connectUser(server, id);

      send(ws, { type: "join_queue" });
      const msg = await waitForMessage(ws, "queue_joined");

      assert(msg.elo === 1337, `L'ELO doit être 1337, vaut ${msg.elo}`);
      assert(server.queueManager.has(id), "Le joueur doit être dans la file");
    });
  }),

  test("queue: un nouveau joueur part de 1000", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId());
      send(ws, { type: "join_queue" });
      const msg = await waitForMessage(ws, "queue_joined");
      assert(
        msg.elo === 1000,
        `L'ELO de départ doit être 1000, vaut ${msg.elo}`,
      );
    });
  }),

  test("queue: refuse d'entrer deux fois", async () => {
    await withServer(async (server) => {
      const p = await queuePlayer(server);
      send(p.ws, { type: "join_queue" });
      const err = await waitForMessage(p.ws, "error");
      assert(
        err.message === "Already in queue",
        `Message inattendu : ${err.message}`,
      );
      assert(
        server.queueManager.size() === 1,
        "Le joueur ne doit être qu'une fois dans la file",
      );
    });
  }),

  test("queue: leave_queue répond queue_left et retire le joueur", async () => {
    await withServer(async (server) => {
      const p = await queuePlayer(server);
      send(p.ws, { type: "leave_queue" });
      await waitForMessage(p.ws, "queue_left");
      assert(
        !server.queueManager.has(p.id),
        "Le joueur ne doit plus être dans la file",
      );
    });
  }),

  test("queue: leave_queue sans être dans la file → erreur", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId());
      send(ws, { type: "leave_queue" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Not in queue",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("queue: peut revenir dans la file après en être sorti", async () => {
    await withServer(async (server) => {
      const p = await queuePlayer(server);
      send(p.ws, { type: "leave_queue" });
      await waitForMessage(p.ws, "queue_left");
      send(p.ws, { type: "join_queue" });
      await waitForMessage(p.ws, "queue_joined");
      assert(
        server.queueManager.has(p.id),
        "Le joueur doit être de retour dans la file",
      );
    });
  }),

  test("queue: un utilisateur absent de la base est refusé", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("ghost"));
      send(ws, { type: "join_queue" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "User not found",
        `Message inattendu : ${err.message}`,
      );
      assert(server.queueManager.size() === 0, "La file doit rester vide");
    });
  }),

  test("queue: la déconnexion retire le joueur de la file", async () => {
    await withServer(async (server) => {
      const p = await queuePlayer(server);
      await closeWs(p.ws);
      assert(
        !server.queueManager.has(p.id),
        "Le joueur déconnecté doit sortir de la file",
      );
    });
  }),

  test("queue: refuse un joueur déjà en partie", async () => {
    await withServer(async (server) => {
      // Une partie classic contre un bot, via une room
      const id = uniqueUserId();
      const ws = await connectUser(server, id);
      send(ws, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "r",
      });
      const room = await waitForMessage(ws, "room_updated");
      send(ws, { type: "add_bot", roomCode: room.room.code });
      await waitForMessage(ws, "room_updated");
      send(ws, { type: "start_game", roomCode: room.room.code });
      const started = await waitForMessage(ws, "game_started");
      send(ws, { type: "join_game", gameId: started.gameId });
      await waitForMessage(ws, "game_updated");

      send(ws, { type: "join_queue" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Already in a game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Formation des parties ----------------

  test("match: 4 joueurs de même niveau → une partie à 4", async () => {
    await withServer(async (server) => {
      const { players, found } = await queueAndMatch(
        server,
        [1000, 1010, 1020, 990],
      );

      const gameIds = new Set(found.map((m) => m.gameId));
      assert(
        gameIds.size === 1,
        "Les 4 joueurs doivent être dans la même partie",
      );
      for (const m of found) {
        assert(
          m.players.length === 4,
          `match_found doit lister 4 joueurs, en liste ${m.players.length}`,
        );
      }
      assert(
        server.queueManager.size() === 0,
        "La file doit être vide après le match",
      );
      for (const p of players) {
        assert(
          !server.queueManager.has(p.id),
          `${p.id} doit être sorti de la file`,
        );
      }
    });
  }),

  test("match: match_found contient les pseudos et les ELO", async () => {
    await withServer(async (server) => {
      const elos = [1000, 1030, 1060, 970];
      const { players, found } = await queueAndMatch(server, elos);

      for (let i = 0; i < players.length; i++) {
        const listed = found[0].players.find(
          (x: any) => x.id === players[i].id,
        );
        assert(listed !== undefined, `${players[i].id} doit être listé`);
        assert(listed.username === `user_${players[i].id}`, "Pseudo incorrect");
        assert(listed.elo === elos[i], `ELO incorrect pour ${players[i].id}`);
      }
    });
  }),

  test("match: la partie créée est en ranked avec les 4 joueurs", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      const game = server.gameManager.getGame(gameId);

      assert(game !== undefined, "La partie doit exister");
      assert(
        game!.mode === GameMode.RANKED,
        `Le mode doit être ranked, est ${game!.mode}`,
      );
      assert(game!.players.length === 4, "La partie doit avoir 4 joueurs");
      for (const p of players) {
        assert(
          game!.players.some((x) => x.userId === p.id),
          `${p.id} doit être dans la partie`,
        );
      }
      assert(
        !game!.players.some((x) => x.userId.startsWith("bot_")),
        "Il ne doit jamais y avoir de bot en ranked",
      );
    });
  }),

  test("match: 3 joueurs qui viennent d'arriver → pas de partie", async () => {
    await withServer(async (server) => {
      const players: Player[] = [];
      for (const elo of [1000, 1010, 1020])
        players.push(await queuePlayer(server, elo));

      const msgs = await collect(players[0].ws, TICK_MS * 5);
      assert(
        !msgs.some((m) => m.type === "match_found"),
        "Ils doivent attendre un 4e joueur",
      );
      assert(
        server.queueManager.size() === 3,
        "Les 3 joueurs doivent rester dans la file",
      );
    });
  }),

  test("match: des ELO trop éloignés ne sont pas mis ensemble", async () => {
    await withServer(async (server) => {
      const players: Player[] = [];
      for (const elo of [1000, 1010, 1020, 1500])
        players.push(await queuePlayer(server, elo));

      const msgs = await collect(players[0].ws, TICK_MS * 5);
      assert(
        !msgs.some((m) => m.type === "match_found"),
        "Le joueur à 1500 ne doit pas compléter la partie",
      );
      assert(
        server.queueManager.size() === 4,
        "Les 4 joueurs doivent rester dans la file",
      );
    });
  }),

  test("match: un joueur sorti de la file avant le tick n'est pas pris", async () => {
    await withServer(async (server) => {
      const players: Player[] = [];
      for (let i = 0; i < 3; i++) players.push(await queuePlayer(server));

      // Le 4e entre puis ressort aussitôt
      const quitter = uniqueUserId();
      const ws = await connectUser(server, quitter);
      send(ws, { type: "join_queue" });
      await waitForMessage(ws, "queue_joined");
      send(ws, { type: "leave_queue" });
      await waitForMessage(ws, "queue_left");

      const msgs = await collect(players[0].ws, TICK_MS * 5);
      assert(
        !msgs.some((m) => m.type === "match_found"),
        "Il ne reste que 3 joueurs : pas de partie",
      );
    });
  }),

  test("match: 8 joueurs → deux parties distinctes", async () => {
    await withServer(async (server) => {
      const players: Player[] = [];
      for (let i = 0; i < 8; i++)
        players.push(await queuePlayer(server, 1000 + i * 5));

      const found = await Promise.all(
        players.map((p) => waitForMessage(p.ws, "match_found", 3000)),
      );
      const gameIds = new Set(found.map((m) => m.gameId));
      assert(
        gameIds.size === 2,
        `Doit former 2 parties, en a formé ${gameIds.size}`,
      );

      for (const gameId of gameIds) {
        const count = found.filter((m) => m.gameId === gameId).length;
        assert(
          count === 4,
          `Chaque partie doit avoir 4 joueurs, en a ${count}`,
        );
      }
      assert(server.queueManager.size() === 0, "La file doit être vide");
    });
  }),

  test("match: les joueurs trouvés peuvent rejoindre la partie", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      for (const p of players) {
        send(p.ws, { type: "join_game", gameId });
        const state = await waitForMessage(p.ws, "game_updated");
        assert(
          state.state.mode === GameMode.RANKED,
          "Le state doit être en ranked",
        );
        const me = state.state.players.find((x: any) => x.userId === p.id);
        assert(
          me.hand.every((c: any) => c.id !== ""),
          "Le joueur doit voir ses cartes",
        );
      }
    });
  }),

  test("match: un joueur trouvé ne peut pas revenir dans la file", async () => {
    await withServer(async (server) => {
      const { players } = await queueAndMatch(server, [1000, 1000, 1000, 1000]);
      send(players[0].ws, { type: "join_queue" });
      const err = await waitForMessage(players[0].ws, "error");
      assert(
        err.message === "Already in a game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Partie abandonnée avant de commencer ----------------

  test("match: si personne ne rejoint, la partie est annulée sans toucher à l'ELO", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1100, 1050, 1020],
      );
      const elosBefore = players.map((p) => server.db.elo(p.id));

      await sleep(JOIN_TIMEOUT_MS + 300);

      assert(
        server.gameManager.getGame(gameId) === undefined,
        "La partie doit être supprimée",
      );
      assert(
        server.db.matches.length === 0,
        "Aucun match ne doit être enregistré",
      );
      players.forEach((p, i) =>
        assert(
          server.db.elo(p.id) === elosBefore[i],
          `L'ELO de ${p.id} ne doit pas changer`,
        ),
      );

      // Ils peuvent relancer une recherche
      send(players[0].ws, { type: "join_queue" });
      await waitForMessage(players[0].ws, "queue_joined");
    });
  }),

  test("match: si au moins un joueur rejoint, la partie n'est pas annulée", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      send(players[0].ws, { type: "join_game", gameId });
      await waitForMessage(players[0].ws, "game_updated");

      await sleep(JOIN_TIMEOUT_MS + 300);
      assert(
        server.gameManager.getGame(gameId) !== undefined,
        "La partie doit continuer",
      );
    });
  }),

  // ---------------- La ranked passe uniquement par la file ----------------

  test("ranked: créer une room ranked par WebSocket est refusé", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId());
      send(ws, {
        type: "create_room",
        mode: GameMode.RANKED,
        maxPlayers: 4,
        name: "r",
      });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Ranked games are only available through matchmaking",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Fin de partie et ELO ----------------

  test("elo: partie ranked complète → elo_updated reçu par tous", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const updates = Promise.all(
        players.map((p) => waitForMessage(p.ws, "elo_updated", 30000, false)),
      );
      await playToEnd(server, players, gameId);
      const received = await updates;

      for (const msg of received) {
        assert(
          msg.changes.length === 4,
          `elo_updated doit contenir 4 joueurs, en a ${msg.changes.length}`,
        );
      }
    });
  }),

  test("elo: les nouveaux ELO sont enregistrés en base", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const update = waitForMessage(players[0].ws, "elo_updated", 30000, false);
      await playToEnd(server, players, gameId);
      const msg = await update;

      for (const c of msg.changes) {
        assert(
          server.db.elo(c.userId) === c.newElo,
          `En base, ${c.userId} a ${server.db.elo(c.userId)} au lieu de ${c.newElo}`,
        );
        assert(c.oldElo === 1000, `oldElo doit être 1000 pour ${c.userId}`);
      }
    });
  }),

  test("elo: le 1er gagne, le dernier perd, et les points s'équilibrent", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const update = waitForMessage(players[0].ws, "elo_updated", 30000, false);
      await playToEnd(server, players, gameId);
      const msg = await update;

      const match = server.db.matches[0];
      const first = msg.changes.find((c: any) => c.userId === match.ranking[0]);
      const last = msg.changes.find((c: any) => c.userId === match.ranking[3]);
      assert(first.newElo > first.oldElo, "Le 1er doit gagner des points");
      assert(last.newElo < last.oldElo, "Le dernier doit perdre des points");

      const sum = msg.changes.reduce(
        (s: number, c: any) => s + (c.newElo - c.oldElo),
        0,
      );
      assert(
        Math.abs(sum) <= 2,
        `Les gains et les pertes doivent s'équilibrer (somme ${sum})`,
      );
    });
  }),

  test("elo: le match ranked est enregistré avec le bon gagnant", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const ended = waitForMessage(players[0].ws, "game_ended", 30000, false);
      await playToEnd(server, players, gameId);
      const endMsg = await ended;
      await sleep(100);

      assert(server.db.matches.length === 1, "Un match doit être enregistré");
      const match = server.db.matches[0];
      assert(match.mode === GameMode.RANKED, "Le match doit être en ranked");
      assert(
        match.ranking.length === 4,
        `Le classement doit avoir 4 joueurs, en a ${match.ranking.length}`,
      );
      assert(
        match.winnerId === match.ranking[0],
        `Le gagnant enregistré (${match.winnerId}) doit être le 1er du classement (${match.ranking[0]})`,
      );
      assert(
        endMsg.winnerId === match.ranking[0],
        `game_ended doit annoncer le 1er du classement, annonce ${endMsg.winnerId}`,
      );
    });
  }),

  test("elo: la partie est supprimée après la fin", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const update = waitForMessage(players[0].ws, "elo_updated", 30000, false);
      await playToEnd(server, players, gameId);
      await update;
      await sleep(100);

      assert(
        server.gameManager.getGame(gameId) === undefined,
        "La partie doit être supprimée",
      );
      send(players[0].ws, { type: "join_queue" });
      await waitForMessage(players[0].ws, "queue_joined");
    });
  }),

  test("elo: abandon → celui qui reste gagne, ceux qui partent perdent", async () => {
    await withServer(async (server) => {
      const { players, gameId } = await queueAndMatch(
        server,
        [1000, 1000, 1000, 1000],
      );
      await joinAll(players, gameId);

      const [stayer, ...leavers] = players;
      const update = waitForMessage(stayer.ws, "elo_updated", 5000, false);
      for (const p of leavers) await closeWs(p.ws);
      const msg = await update;

      const stayerChange = msg.changes.find((c: any) => c.userId === stayer.id);
      assert(
        stayerChange.newElo > stayerChange.oldElo,
        `Celui qui reste doit gagner des points (${stayerChange.oldElo} → ${stayerChange.newElo})`,
      );
      for (const p of leavers) {
        const c = msg.changes.find((x: any) => x.userId === p.id);
        assert(
          c.newElo < c.oldElo,
          `${p.id} est parti et doit perdre des points`,
        );
      }
    });
  }),

  test("elo: une partie classic ne change pas l'ELO", async () => {
    await withServer(async (server) => {
      const idA = uniqueUserId();
      const idB = uniqueUserId();
      server.db.setElo(idA, 1200);
      server.db.setElo(idB, 1200);
      const wsA = await connectUser(server, idA);
      const wsB = await connectUser(server, idB);

      send(wsA, {
        type: "create_room",
        mode: GameMode.CLASSIC,
        maxPlayers: 2,
        name: "c",
      });
      const room = await waitForMessage(wsA, "room_updated");
      send(wsB, { type: "join_room", roomCode: room.room.code });
      await waitForMessage(wsB, "room_updated");

      const startedA = waitForMessage(wsA, "game_started");
      const startedB = waitForMessage(wsB, "game_started");
      send(wsA, { type: "start_game", roomCode: room.room.code });
      const { gameId } = await startedA;
      await startedB;
      send(wsA, { type: "join_game", gameId });
      await waitForMessage(wsA, "game_updated");
      send(wsB, { type: "join_game", gameId });
      await waitForMessage(wsB, "game_updated");

      // A abandonne : la partie se termine au bout du délai de grâce
      const msgsB = collect(wsB, GRACE_MS + 800);
      await closeWs(wsA);
      const received = await msgsB;

      assert(
        received.some((m) => m.type === "game_ended"),
        "La partie doit se terminer",
      );
      assert(
        !received.some((m) => m.type === "elo_updated"),
        "Pas d'elo_updated en classic",
      );
      assert(
        server.db.elo(idA) === 1200 && server.db.elo(idB) === 1200,
        "Les ELO ne doivent pas changer",
      );

      const match = server.db.matches[0];
      assert(
        match.winnerId === idB,
        `B doit être enregistré comme gagnant, gagnant = ${match.winnerId}`,
      );
    });
  }),
];

// ============================================================
// RUNNER
// ============================================================

// Filet de sécurité : une promesse rejetée et non écoutée ne doit pas tuer le process
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
