import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { WebSocket } from "ws";
import { GameMode, GameStatus } from "shared";
import { GameManager } from "../src/managers/game.manager.js";
import { RoomManager } from "../src/managers/room.manager.js";

// Délai de grâce court : doit être défini AVANT de charger le gateway
const GRACE_MS = 500;
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
// HELPERS
// ============================================================

async function buildServer() {
  const fastify = Fastify({ logger: false });
  const gameManager = new GameManager();
  const roomManager = new RoomManager();
  const sockets: WebSocket[] = [];

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

  return { fastify, port, gameManager, roomManager, sockets };
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
  await sleep(100); // laisse le handler "close" du serveur s'exécuter
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

async function createRoom(ws: WebSocket, maxPlayers: number): Promise<string> {
  send(ws, {
    type: "create_room",
    mode: GameMode.CLASSIC,
    maxPlayers,
    name: "Spectator Room",
  });
  const msg = await waitForMessage(ws, "room_updated");
  return msg.room.code;
}

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

// Partie entre deux humains, sans bot : les coups sont déterministes
async function setupHumanGame(server: Server) {
  const idA = uniqueUserId("alice");
  const idB = uniqueUserId("bob");
  const wsA = await connectUser(server, idA);
  const wsB = await connectUser(server, idB);

  const roomCode = await createRoom(wsA, 2);
  send(wsB, { type: "join_room", roomCode });
  await waitForMessage(wsB, "room_updated");

  const gameId = await startAndJoin(wsA, roomCode, [wsA, wsB]);
  return { idA, idB, wsA, wsB, gameId };
}

// Partie humain contre bot
async function setupBotGame(server: Server) {
  const idA = uniqueUserId("alice");
  const wsA = await connectUser(server, idA);
  const roomCode = await createRoom(wsA, 2);
  send(wsA, { type: "add_bot", roomCode });
  await waitForMessage(wsA, "room_updated");
  const gameId = await startAndJoin(wsA, roomCode, [wsA]);
  return { idA, wsA, gameId };
}

// Connecte un nouvel utilisateur et le fait regarder la partie
async function spectate(server: Server, gameId: string) {
  const id = uniqueUserId("watcher");
  const ws = await connectUser(server, id);
  send(ws, { type: "spectate_game", gameId });
  const started = await waitForMessage(ws, "spectate_started");
  return { id, ws, started };
}

function allHandsHidden(state: any): boolean {
  return state.players.every((p: any) =>
    p.hand.every((c: any) => c.id === "" && c.value === "wild"),
  );
}

// ============================================================
// TESTS
// ============================================================

const tests = [
  // ---------------- Démarrage du mode spectateur ----------------

  test("spectate: reçoit spectate_started avec l'état de la partie", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { started } = await spectate(server, gameId);

      assert(
        started.state !== undefined,
        "spectate_started doit contenir un state",
      );
      assert(
        started.state.id === gameId,
        "Le state doit être celui de la partie",
      );
      assert(
        started.state.status === GameStatus.IN_PROGRESS,
        "La partie doit être en cours",
      );
    });
  }),

  test("spectate: toutes les mains sont cachées", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { started } = await spectate(server, gameId);

      assert(
        allHandsHidden(started.state),
        "Le spectateur ne doit voir aucune carte",
      );
    });
  }),

  test("spectate: le nombre de cartes de chaque joueur est correct", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { started } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;

      for (const real of game.players) {
        const seen = started.state.players.find(
          (p: any) => p.userId === real.userId,
        );
        assert(
          seen !== undefined,
          `Le joueur ${real.userId} doit être visible`,
        );
        assert(
          seen.hand.length === real.hand.length,
          `Nombre de cartes faux pour ${real.userId} : ${seen.hand.length} au lieu de ${real.hand.length}`,
        );
      }
    });
  }),

  test("spectate: voit la carte du dessus, la couleur et le tour courant", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { started } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;

      assert(
        started.state.topCard.id === game.topCard.id,
        "topCard doit être visible",
      );
      assert(
        started.state.currentColor === game.currentColor,
        "currentColor doit être visible",
      );
      const current = game.players.find((p) => p.isCurrentTurn)!;
      const seenCurrent = started.state.players.find(
        (p: any) => p.isCurrentTurn,
      );
      assert(
        seenCurrent?.userId === current.userId,
        "Le joueur courant doit être visible",
      );
    });
  }),

  test("spectate: plusieurs spectateurs peuvent regarder la même partie", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const s1 = await spectate(server, gameId);
      const s2 = await spectate(server, gameId);
      const s3 = await spectate(server, gameId);

      for (const s of [s1, s2, s3]) {
        assert(
          s.started.state.id === gameId,
          "Chaque spectateur doit recevoir l'état",
        );
      }
    });
  }),

  test("spectate: un même socket peut regarder deux parties différentes", async () => {
    await withServer(async (server) => {
      const g1 = await setupHumanGame(server);
      const g2 = await setupHumanGame(server);

      const id = uniqueUserId("watcher");
      const ws = await connectUser(server, id);
      send(ws, { type: "spectate_game", gameId: g1.gameId });
      const st1 = await waitForMessage(ws, "spectate_started");
      send(ws, { type: "spectate_game", gameId: g2.gameId });
      const st2 = await waitForMessage(ws, "spectate_started");

      assert(st1.state.id === g1.gameId, "Doit recevoir la partie 1");
      assert(st2.state.id === g2.gameId, "Doit recevoir la partie 2");
    });
  }),

  // ---------------- Refus ----------------

  test("spectate: refuse une partie inexistante", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("watcher"));
      send(ws, { type: "spectate_game", gameId: "partie-qui-existe-pas" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Game not found",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("spectate: un joueur ne peut pas regarder sa propre partie", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      send(wsA, { type: "spectate_game", gameId });
      const err = await waitForMessage(wsA, "error");
      assert(
        err.message === "You are a player in this game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("spectate: refuse un message sans gameId", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("watcher"));
      send(ws, { type: "spectate_game" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Invalid message format",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("spectate: refuse leave_spectate sans gameId", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("watcher"));
      send(ws, { type: "leave_spectate" });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Invalid message format",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Le spectateur ne peut pas agir ----------------

  test("spectate: ne peut pas jouer de carte", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;
      const topBefore = game.topCard.id;

      // Il tente même de jouer une vraie carte d'un joueur
      const realCard = game.players[0].hand[0];
      send(ws, { type: "play_card", gameId, cardId: realCard.id });
      const err = await waitForMessage(ws, "error");

      assert(
        err.message === "Invalid move",
        `Message inattendu : ${err.message}`,
      );
      assert(
        game.topCard.id === topBefore,
        "La carte du dessus ne doit pas changer",
      );
      assert(
        game.players[0].hand.some((c) => c.id === realCard.id),
        "La carte doit rester dans la main du joueur",
      );
    });
  }),

  test("spectate: ne peut pas piocher", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;
      const pileBefore = game.drawPile.length;

      send(ws, { type: "draw_card", gameId });
      const err = await waitForMessage(ws, "error");

      assert(
        err.message === "Cannot draw card",
        `Message inattendu : ${err.message}`,
      );
      assert(
        game.drawPile.length === pileBefore,
        "La pioche ne doit pas changer",
      );
    });
  }),

  test("spectate: ne peut pas rejoindre la partie comme joueur", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      send(ws, { type: "join_game", gameId });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "You are not part of this game",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("spectate: ne peut pas challenger un bluff ni accepter un +4", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      send(ws, { type: "challenge_bluff", gameId });
      const err1 = await waitForMessage(ws, "error");
      assert(err1.type === "error", "challenge_bluff doit être refusé");

      send(ws, { type: "accept_wild_draw4", gameId });
      const err2 = await waitForMessage(ws, "error");
      assert(err2.type === "error", "accept_wild_draw4 doit être refusé");
    });
  }),

  // ---------------- Réception des mises à jour ----------------

  test("spectate: reçoit game_updated quand un joueur joue", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const update = waitForMessage(ws, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      const msg = await update;

      assert(
        msg.state.id === gameId,
        "La mise à jour doit concerner la partie",
      );
    });
  }),

  test("spectate: les mises à jour cachent toujours toutes les mains", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, idA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;

      // Plusieurs tours : chacun pioche à son tour
      for (let i = 0; i < 6; i++) {
        const current = game.players.find((p) => p.isCurrentTurn)!;
        const wsCurrent = current.userId === idA ? wsA : wsB;
        const update = waitForMessage(ws, "game_updated");
        send(wsCurrent, { type: "draw_card", gameId });
        const msg = await update;
        assert(
          allHandsHidden(msg.state),
          `Une main est visible au tour ${i + 1}`,
        );
      }
    });
  }),

  test("spectate: le nombre de cartes suit les coups", async () => {
    await withServer(async (server) => {
      const { wsA, idA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;
      const before = game.players.find((p) => p.userId === idA)!.hand.length;

      const update = waitForMessage(ws, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      const msg = await update;

      const seenA = msg.state.players.find((p: any) => p.userId === idA);
      assert(
        seenA.hand.length === before + 1,
        `A doit avoir ${before + 1} cartes pour le spectateur, en a ${seenA.hand.length}`,
      );
    });
  }),

  test("spectate: tous les spectateurs reçoivent la mise à jour", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const s1 = await spectate(server, gameId);
      const s2 = await spectate(server, gameId);

      const u1 = waitForMessage(s1.ws, "game_updated");
      const u2 = waitForMessage(s2.ws, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      await Promise.all([u1, u2]);
    });
  }),

  test("spectate: reçoit les coups des bots", async () => {
    await withServer(async (server) => {
      const { wsA, idA, gameId } = await setupBotGame(server);
      const { ws } = await spectate(server, gameId);
      const game = server.gameManager.getGame(gameId)!;

      const current = game.players.find((p) => p.isCurrentTurn)!;
      if (current.userId === idA) {
        const humanMove = waitForMessage(ws, "game_updated");
        send(wsA, { type: "draw_card", gameId });
        await humanMove;
      }

      // Le bot joue en 0,5 à 1,5 s
      const botMove = await waitForMessage(ws, "game_updated", 3000);
      assert(
        allHandsHidden(botMove.state),
        "La main du bot doit rester cachée",
      );
    });
  }),

  test("spectate: s'abonner deux fois ne duplique pas les mises à jour", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      send(ws, { type: "spectate_game", gameId });
      await waitForMessage(ws, "spectate_started");

      const messages = collect(ws, 500);
      send(wsA, { type: "draw_card", gameId });
      const received = (await messages).filter(
        (m) => m.type === "game_updated",
      );

      assert(
        received.length === 1,
        `Le spectateur doit recevoir 1 game_updated, en a reçu ${received.length}`,
      );
    });
  }),

  test("spectate: les joueurs voient toujours leurs propres cartes", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, idA, idB, gameId } = await setupHumanGame(server);
      await spectate(server, gameId);

      const uA = waitForMessage(wsA, "game_updated");
      const uB = waitForMessage(wsB, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      const [mA, mB] = await Promise.all([uA, uB]);

      const meA = mA.state.players.find((p: any) => p.userId === idA);
      const meB = mB.state.players.find((p: any) => p.userId === idB);
      assert(
        meA.hand.every((c: any) => c.id !== ""),
        "A doit voir ses cartes",
      );
      assert(
        meB.hand.every((c: any) => c.id !== ""),
        "B doit voir ses cartes",
      );

      const otherForA = mA.state.players.find((p: any) => p.userId === idB);
      assert(
        otherForA.hand.every((c: any) => c.id === ""),
        "A ne doit pas voir les cartes de B",
      );
    });
  }),

  test("spectate: les joueurs ne reçoivent pas spectate_started", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const msgsA = collect(wsA, 400);
      const msgsB = collect(wsB, 400);
      await spectate(server, gameId);

      const all = [...(await msgsA), ...(await msgsB)];
      assert(
        !all.some((m) => m.type === "spectate_started"),
        "spectate_started ne doit être envoyé qu'au spectateur",
      );
    });
  }),

  // ---------------- Chat ----------------

  test("chat: le spectateur lit les messages des joueurs", async () => {
    await withServer(async (server) => {
      const { wsA, idA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const chat = waitForMessage(ws, "chat_message");
      send(wsA, { type: "chat_message", gameId, content: "salut" });
      const msg = await chat;

      assert(msg.content === "salut", `Contenu inattendu : ${msg.content}`);
      assert(msg.userId === idA, "Le message doit venir de A");
      assert(
        msg.username !== "",
        "Le pseudo de l'expéditeur doit être présent",
      );
    });
  }),

  test("chat: le spectateur ne peut pas écrire", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const msgsA = collect(wsA, 400);
      const msgsB = collect(wsB, 400);
      send(ws, { type: "chat_message", gameId, content: "je suis spectateur" });
      const err = await waitForMessage(ws, "error");

      assert(
        err.message === "You are not part of this game",
        `Message inattendu : ${err.message}`,
      );
      const all = [...(await msgsA), ...(await msgsB)];
      assert(
        !all.some((m) => m.type === "chat_message"),
        "Les joueurs ne doivent pas recevoir le message du spectateur",
      );
    });
  }),

  test("chat: un utilisateur extérieur ne peut pas écrire", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const outsider = await connectUser(server, uniqueUserId("outsider"));

      const msgsA = collect(wsA, 400);
      send(outsider, { type: "chat_message", gameId, content: "coucou" });
      const err = await waitForMessage(outsider, "error");

      assert(
        err.message === "You are not part of this game",
        `Message inattendu : ${err.message}`,
      );
      assert(
        !(await msgsA).some((m) => m.type === "chat_message"),
        "A ne doit pas recevoir le message d'un extérieur",
      );
    });
  }),

  test("chat: refuse un message vide", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      send(wsA, { type: "chat_message", gameId, content: "" });
      const err = await waitForMessage(wsA, "error");
      assert(
        err.message === "Invalid message",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("chat: refuse un message composé uniquement d'espaces", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      send(wsA, { type: "chat_message", gameId, content: "    \n\t  " });
      const err = await waitForMessage(wsA, "error");
      assert(
        err.message === "Invalid message",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("chat: refuse un message de plus de 500 caractères", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      send(wsA, { type: "chat_message", gameId, content: "a".repeat(501) });
      const err = await waitForMessage(wsA, "error");
      assert(
        err.message === "Invalid message",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("chat: accepte un message de exactement 500 caractères", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const chat = waitForMessage(wsB, "chat_message");
      send(wsA, { type: "chat_message", gameId, content: "a".repeat(500) });
      const msg = await chat;
      assert(
        msg.content.length === 500,
        "Le message de 500 caractères doit passer",
      );
    });
  }),

  test("chat: les espaces autour du message sont retirés", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const chatB = waitForMessage(wsB, "chat_message");
      const chatS = waitForMessage(ws, "chat_message");
      send(wsA, { type: "chat_message", gameId, content: "   gg   " });
      const [mB, mS] = await Promise.all([chatB, chatS]);

      assert(mB.content === "gg", `B a reçu "${mB.content}"`);
      assert(mS.content === "gg", `Le spectateur a reçu "${mS.content}"`);
    });
  }),

  test("chat: refuse un message pour une partie inexistante", async () => {
    await withServer(async (server) => {
      const ws = await connectUser(server, uniqueUserId("player"));
      send(ws, {
        type: "chat_message",
        gameId: "partie-qui-existe-pas",
        content: "hey",
      });
      const err = await waitForMessage(ws, "error");
      assert(
        err.message === "Game not found",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  // ---------------- Quitter le mode spectateur ----------------

  test("leave_spectate: ne reçoit plus de mises à jour", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      send(ws, { type: "leave_spectate", gameId });
      await sleep(100);

      const messages = collect(ws, 500);
      send(wsA, { type: "draw_card", gameId });
      const received = await messages;

      assert(
        !received.some((m) => m.type === "game_updated"),
        "Le spectateur parti ne doit plus rien recevoir",
      );
    });
  }),

  test("leave_spectate: les autres spectateurs continuent de recevoir", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const s1 = await spectate(server, gameId);
      const s2 = await spectate(server, gameId);

      send(s1.ws, { type: "leave_spectate", gameId });
      await sleep(100);

      const update = waitForMessage(s2.ws, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      await update;
    });
  }),

  test("leave_spectate: sans être spectateur, ne plante pas et ne répond rien", async () => {
    await withServer(async (server) => {
      const { gameId } = await setupHumanGame(server);
      const ws = await connectUser(server, uniqueUserId("watcher"));

      const messages = collect(ws, 400);
      send(ws, { type: "leave_spectate", gameId });
      send(ws, { type: "leave_spectate", gameId: "partie-qui-existe-pas" });
      const received = await messages;

      assert(
        !received.some((m) => m.type === "error"),
        "leave_spectate ne doit pas renvoyer d'erreur",
      );
      assert(ws.readyState === WebSocket.OPEN, "Le socket doit rester ouvert");
    });
  }),

  test("leave_spectate: peut revenir regarder après être parti", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      send(ws, { type: "leave_spectate", gameId });
      await sleep(100);
      send(ws, { type: "spectate_game", gameId });
      await waitForMessage(ws, "spectate_started");

      const update = waitForMessage(ws, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      await update;
    });
  }),

  // ---------------- Déconnexions ----------------

  test("spectate: la déconnexion du spectateur ne gêne pas la partie", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      await closeWs(ws);

      const uB = waitForMessage(wsB, "game_updated");
      send(wsA, { type: "draw_card", gameId });
      await uB;

      await sleep(GRACE_MS + 300);
      const game = server.gameManager.getGame(gameId);
      assert(
        game?.status === GameStatus.IN_PROGRESS,
        "La partie doit continuer après le départ du spectateur",
      );
    });
  }),

  test("spectate: le spectateur ne reçoit pas player_left à son propre départ", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const { ws, id } = await spectate(server, gameId);

      const msgsA = collect(wsA, 400);
      const msgsB = collect(wsB, 400);
      await closeWs(ws);

      const all = [...(await msgsA), ...(await msgsB)];
      assert(
        !all.some((m) => m.type === "player_left" && m.userId === id),
        "Le départ d'un spectateur ne doit pas être annoncé comme un départ de joueur",
      );
    });
  }),

  test("spectate: reçoit player_left quand un joueur part", async () => {
    await withServer(async (server) => {
      const { wsA, idA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const left = waitForMessage(ws, "player_left");
      await closeWs(wsA);
      const msg = await left;
      assert(msg.userId === idA, "player_left doit concerner A");
    });
  }),

  test("spectate: un spectateur ne maintient pas en vie une partie sans joueur", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupBotGame(server);
      await spectate(server, gameId);

      await closeWs(wsA);
      await sleep(GRACE_MS + 300);

      assert(
        server.gameManager.getGame(gameId) === undefined,
        "La partie doit être terminée même si quelqu'un la regarde",
      );
    });
  }),

  // ---------------- Fin de partie ----------------

  test("spectate: reçoit game_ended avec le gagnant", async () => {
    await withServer(async (server) => {
      const { wsA, idB, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const ended = waitForMessage(ws, "game_ended", GRACE_MS + 3000);
      await closeWs(wsA);
      const msg = await ended;

      assert(msg.winnerId === idB, `B doit gagner, winnerId = ${msg.winnerId}`);
    });
  }),

  test("spectate: impossible de regarder une partie terminée", async () => {
    await withServer(async (server) => {
      const { wsA, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const ended = waitForMessage(ws, "game_ended", GRACE_MS + 3000);
      await closeWs(wsA);
      await ended;
      await sleep(100);

      const late = await connectUser(server, uniqueUserId("late"));
      send(late, { type: "spectate_game", gameId });
      const err = await waitForMessage(late, "error");
      assert(
        err.message === "Game not found",
        `Message inattendu : ${err.message}`,
      );
    });
  }),

  test("spectate: plus aucun message après la fin de la partie", async () => {
    await withServer(async (server) => {
      const { wsA, wsB, gameId } = await setupHumanGame(server);
      const { ws } = await spectate(server, gameId);

      const ended = waitForMessage(ws, "game_ended", GRACE_MS + 3000);
      await closeWs(wsA);
      await ended;

      const messages = collect(ws, 400);
      send(wsB, { type: "draw_card", gameId });
      const received = await messages;
      assert(
        !received.some((m) => m.type === "game_updated"),
        "Le spectateur ne doit plus recevoir de mises à jour après la fin",
      );
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
