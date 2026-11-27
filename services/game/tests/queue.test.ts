import { QueueManager } from "../src/managers/queue.manager.js";
import { findMatch } from "../src/engine/matchmaking.js";
import type { QueueEntry } from "../src/engine/matchmaking.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${name}: ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const NOW = 10_000_000;

function entry(id: string, elo = 1000, waitedMs = 0): QueueEntry {
  return { userId: id, username: `user_${id}`, elo, joinedAt: NOW - waitedMs };
}

function ids(entries: QueueEntry[]): string {
  return entries
    .map((e) => e.userId)
    .sort()
    .join();
}

// ============================================================
// FILE VIDE
// ============================================================

test("queue: une nouvelle file est vide", () => {
  const q = new QueueManager();
  assert(q.size() === 0, `size doit valoir 0, vaut ${q.size()}`);
  assert(q.list().length === 0, "list doit être vide");
});

test("queue: has renvoie false sur une file vide", () => {
  const q = new QueueManager();
  assert(q.has("a") === false, "has doit renvoyer false");
});

test("queue: leave sur une file vide renvoie false", () => {
  const q = new QueueManager();
  assert(q.leave("a") === false, "leave doit renvoyer false");
});

test("queue: removeMany sur une file vide ne plante pas", () => {
  const q = new QueueManager();
  q.removeMany(["a", "b"]);
  assert(q.size() === 0, "La file doit rester vide");
});

// ============================================================
// JOIN
// ============================================================

test("queue: join ajoute un joueur", () => {
  const q = new QueueManager();
  assert(q.join(entry("a")) === true, "join doit renvoyer true");
  assert(q.has("a"), "has doit renvoyer true");
  assert(q.size() === 1, `size doit valoir 1, vaut ${q.size()}`);
});

test("queue: join conserve toutes les infos du joueur", () => {
  const q = new QueueManager();
  const e = entry("a", 1337, 5_000);
  q.join(e);
  const stored = q.list()[0];
  assert(stored.userId === "a", "userId incorrect");
  assert(stored.username === "user_a", "username incorrect");
  assert(stored.elo === 1337, "elo incorrect");
  assert(stored.joinedAt === NOW - 5_000, "joinedAt incorrect");
});

test("queue: un joueur ne peut pas entrer deux fois", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  assert(q.join(entry("a")) === false, "Le second join doit renvoyer false");
  assert(q.size() === 1, `size doit rester à 1, vaut ${q.size()}`);
});

test("queue: un second join ne remplace pas la première entrée", () => {
  // Sinon, un joueur pourrait remettre son temps d'attente à zéro ou changer d'ELO
  const q = new QueueManager();
  q.join(entry("a", 1000, 30_000));
  q.join(entry("a", 2000, 0));
  const stored = q.list()[0];
  assert(stored.elo === 1000, `L'ELO doit rester 1000, vaut ${stored.elo}`);
  assert(
    stored.joinedAt === NOW - 30_000,
    "L'heure d'arrivée ne doit pas changer",
  );
});

test("queue: plusieurs joueurs différents", () => {
  const q = new QueueManager();
  for (const id of ["a", "b", "c", "d", "e"]) q.join(entry(id));
  assert(q.size() === 5, `size doit valoir 5, vaut ${q.size()}`);
  for (const id of ["a", "b", "c", "d", "e"])
    assert(q.has(id), `${id} doit être dans la file`);
});

// ============================================================
// LEAVE
// ============================================================

test("queue: leave retire le joueur", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  assert(q.leave("a") === true, "leave doit renvoyer true");
  assert(!q.has("a"), "Le joueur ne doit plus être dans la file");
  assert(q.size() === 0, `size doit valoir 0, vaut ${q.size()}`);
});

test("queue: leave deux fois → false la seconde fois", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.leave("a");
  assert(q.leave("a") === false, "Le second leave doit renvoyer false");
});

test("queue: leave d'un joueur absent ne touche pas aux autres", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.join(entry("b"));
  q.leave("z");
  assert(q.size() === 2, "Les autres joueurs doivent rester");
});

test("queue: leave ne retire que le joueur demandé", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.join(entry("b"));
  q.join(entry("c"));
  q.leave("b");
  assert(
    ids(q.list()) === "a,c",
    `Il doit rester a et c, reste ${ids(q.list())}`,
  );
});

test("queue: un joueur peut revenir après être parti", () => {
  const q = new QueueManager();
  q.join(entry("a", 1000, 50_000));
  q.leave("a");
  assert(q.join(entry("a", 1100, 0)) === true, "Le retour doit être accepté");
  const stored = q.list()[0];
  assert(stored.elo === 1100, "La nouvelle entrée doit être prise en compte");
  assert(stored.joinedAt === NOW, "Le temps d'attente repart de zéro");
});

// ============================================================
// LIST
// ============================================================

test("queue: list renvoie tous les joueurs", () => {
  const q = new QueueManager();
  for (const id of ["a", "b", "c"]) q.join(entry(id));
  assert(ids(q.list()) === "a,b,c", `list incorrecte : ${ids(q.list())}`);
});

test("queue: list renvoie une copie, modifier le tableau ne touche pas la file", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.join(entry("b"));
  const l = q.list();
  l.pop();
  l.push(entry("intrus"));
  assert(q.size() === 2, "La file ne doit pas changer de taille");
  assert(
    !q.has("intrus"),
    "Un joueur ajouté au tableau ne doit pas entrer dans la file",
  );
});

test("queue: list est utilisable directement par findMatch", () => {
  const q = new QueueManager();
  for (const id of ["a", "b", "c", "d"]) q.join(entry(id));
  const g = findMatch(q.list(), NOW);
  assert(g !== null && g.length === 4, "findMatch doit trouver une partie à 4");
});

// ============================================================
// REMOVE MANY
// ============================================================

test("queue: removeMany retire tout le groupe", () => {
  const q = new QueueManager();
  for (const id of ["a", "b", "c", "d"]) q.join(entry(id));
  q.removeMany(["a", "b", "c", "d"]);
  assert(q.size() === 0, `La file doit être vide, size = ${q.size()}`);
});

test("queue: removeMany ne retire que les joueurs demandés", () => {
  const q = new QueueManager();
  for (const id of ["a", "b", "c", "d", "e"]) q.join(entry(id));
  q.removeMany(["b", "d"]);
  assert(
    ids(q.list()) === "a,c,e",
    `Il doit rester a, c, e, reste ${ids(q.list())}`,
  );
});

test("queue: removeMany ignore les joueurs absents", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.join(entry("b"));
  q.removeMany(["a", "z", "y"]);
  assert(ids(q.list()) === "b", `Il doit rester b, reste ${ids(q.list())}`);
});

test("queue: removeMany avec une liste vide ne change rien", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.removeMany([]);
  assert(q.size() === 1, "La file ne doit pas changer");
});

test("queue: removeMany gère les doublons dans la liste", () => {
  const q = new QueueManager();
  q.join(entry("a"));
  q.join(entry("b"));
  q.removeMany(["a", "a"]);
  assert(ids(q.list()) === "b", `Il doit rester b, reste ${ids(q.list())}`);
});

// ============================================================
// UTILISATION AVEC LE MATCHMAKER
// ============================================================

test("queue: cycle complet findMatch → removeMany", () => {
  // Ce que fera le matchmaker à chaque tick
  const q = new QueueManager();
  for (let i = 0; i < 9; i++) q.join(entry(`p${i}`, 1000 + i * 5));

  const games: QueueEntry[][] = [];
  let group = findMatch(q.list(), NOW);
  while (group) {
    games.push(group);
    q.removeMany(group.map((e) => e.userId));
    group = findMatch(q.list(), NOW);
  }

  assert(
    games.length === 2,
    `Doit former 2 parties de 4, en a formé ${games.length}`,
  );
  assert(q.size() === 1, `Il doit rester 1 joueur, en reste ${q.size()}`);

  const all = games.flat().map((e) => e.userId);
  assert(
    new Set(all).size === all.length,
    "Un joueur ne doit pas être dans deux parties",
  );
  assert(
    all.every((id) => !q.has(id)),
    "Les joueurs en partie ne doivent plus être dans la file",
  );
});

// ============================================================
// RÉSULTATS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
