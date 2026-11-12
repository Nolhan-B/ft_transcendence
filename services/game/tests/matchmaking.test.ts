import {
  findMatch,
  eloRange,
  minPlayers,
  TARGET_PLAYERS,
  BASE_RANGE,
  MAX_RANGE,
} from "../src/engine/matchmaking.js";
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

// Instant de référence fixe : les tests ne dépendent pas de l'horloge
const NOW = 10_000_000;

// Crée une entrée de file : `waitedMs` = depuis combien de temps il attend
function entry(id: string, elo: number, waitedMs = 0): QueueEntry {
  return { userId: id, username: id, elo, joinedAt: NOW - waitedMs };
}

function ids(group: QueueEntry[] | null): string[] {
  return group ? group.map((e) => e.userId).sort() : [];
}

function spread(group: QueueEntry[]): number {
  const elos = group.map((e) => e.elo);
  return Math.max(...elos) - Math.min(...elos);
}

// ============================================================
// ELO RANGE
// ============================================================

test("eloRange: ±100 à l'arrivée", () => {
  assert(eloRange(entry("a", 1000, 0), NOW) === BASE_RANGE, "Doit valoir 100");
});

test("eloRange: reste à 100 juste avant 10s", () => {
  assert(eloRange(entry("a", 1000, 9_999), NOW) === 100, "Doit valoir 100");
});

test("eloRange: passe à 150 à 10s", () => {
  assert(eloRange(entry("a", 1000, 10_000), NOW) === 150, "Doit valoir 150");
});

test("eloRange: 250 à 30s", () => {
  assert(eloRange(entry("a", 1000, 30_000), NOW) === 250, "Doit valoir 250");
});

test("eloRange: atteint le plafond à 80s", () => {
  assert(
    eloRange(entry("a", 1000, 80_000), NOW) === MAX_RANGE,
    "Doit valoir 500",
  );
});

test("eloRange: ne dépasse jamais le plafond", () => {
  const r = eloRange(entry("a", 1000, 3_600_000), NOW);
  assert(r === MAX_RANGE, `Doit rester à 500 après 1h, vaut ${r}`);
});

test("eloRange: ne dépend pas de l'ELO du joueur", () => {
  const low = eloRange(entry("a", 200, 20_000), NOW);
  const high = eloRange(entry("b", 2500, 20_000), NOW);
  assert(low === high, "La fourchette ne doit dépendre que de l'attente");
});

// ============================================================
// MIN PLAYERS
// ============================================================

test("minPlayers: veut 4 joueurs à l'arrivée", () => {
  assert(
    minPlayers(entry("a", 1000, 0), NOW) === TARGET_PLAYERS,
    "Doit valoir 4",
  );
});

test("minPlayers: veut encore 4 juste avant 20s", () => {
  assert(minPlayers(entry("a", 1000, 19_999), NOW) === 4, "Doit valoir 4");
});

test("minPlayers: accepte 3 à 20s", () => {
  assert(minPlayers(entry("a", 1000, 20_000), NOW) === 3, "Doit valoir 3");
});

test("minPlayers: accepte encore 3 juste avant 40s", () => {
  assert(minPlayers(entry("a", 1000, 39_999), NOW) === 3, "Doit valoir 3");
});

test("minPlayers: accepte 2 à 40s", () => {
  assert(minPlayers(entry("a", 1000, 40_000), NOW) === 2, "Doit valoir 2");
});

test("minPlayers: ne descend jamais sous 2", () => {
  assert(minPlayers(entry("a", 1000, 3_600_000), NOW) === 2, "Doit rester à 2");
});

// ============================================================
// FIND MATCH - CAS DE BASE
// ============================================================

test("findMatch: file vide → null", () => {
  assert(findMatch([], NOW) === null, "Doit renvoyer null");
});

test("findMatch: un seul joueur, même après une longue attente → null", () => {
  const q = [entry("a", 1000, 600_000)];
  assert(findMatch(q, NOW) === null, "Une partie à 1 joueur est impossible");
});

test("findMatch: 4 joueurs proches qui viennent d'arriver → partie à 4", () => {
  const q = [
    entry("a", 1000),
    entry("b", 1020),
    entry("c", 1050),
    entry("d", 980),
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie");
  assert(g!.length === 4, `Doit faire une partie à 4, en a ${g!.length}`);
});

test("findMatch: 3 joueurs qui viennent d'arriver → null (ils veulent 4)", () => {
  const q = [entry("a", 1000), entry("b", 1020), entry("c", 1050)];
  assert(findMatch(q, NOW) === null, "Doit attendre un 4e joueur");
});

test("findMatch: 3 joueurs, le plus ancien attend depuis 20s → partie à 3", () => {
  const q = [entry("a", 1000, 20_000), entry("b", 1020), entry("c", 1050)];
  const g = findMatch(q, NOW);
  assert(g !== null && g.length === 3, "Doit lancer à 3");
});

test("findMatch: 2 joueurs, l'un attend depuis 39s → null (il veut 3)", () => {
  const q = [entry("a", 1000, 39_000), entry("b", 1020)];
  assert(findMatch(q, NOW) === null, "Ne doit pas lancer à 2 avant 40s");
});

test("findMatch: 2 joueurs, l'un attend depuis 40s → partie à 2", () => {
  const q = [entry("a", 1000, 40_000), entry("b", 1020)];
  const g = findMatch(q, NOW);
  assert(g !== null && g.length === 2, "Doit lancer à 2");
  assert(ids(g).join() === "a,b", "Doit contenir a et b");
});

// ============================================================
// FIND MATCH - TAILLE ET PRIORITÉ
// ============================================================

test("findMatch: jamais plus de 4 joueurs", () => {
  const q = [
    entry("a", 1000),
    entry("b", 1010),
    entry("c", 1020),
    entry("d", 1030),
    entry("e", 1040),
    entry("f", 1050),
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie");
  assert(g!.length === TARGET_PLAYERS, `Doit plafonner à 4, en a ${g!.length}`);
});

test("findMatch: le joueur qui attend depuis le plus longtemps est servi en premier", () => {
  const q = [
    entry("new1", 1000, 0),
    entry("new2", 1010, 1_000),
    entry("old", 1020, 15_000),
    entry("new3", 1030, 2_000),
    entry("new4", 1040, 3_000),
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie");
  assert(
    g!.some((e) => e.userId === "old"),
    "Le plus ancien doit faire partie de la partie",
  );
});

test("findMatch: complète avec les ELO les plus proches de l'ancre", () => {
  // L'ancre (la plus ancienne) est à 1000 ; les candidats les plus proches gagnent
  const q = [
    entry("anchor", 1000, 15_000),
    entry("far", 1090, 0),
    entry("close1", 1010, 0),
    entry("close2", 990, 0),
    entry("close3", 1020, 0),
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie");
  assert(
    ids(g).join() === "anchor,close1,close2,close3",
    `Doit prendre les 3 plus proches, a pris ${ids(g).join()}`,
  );
});

test("findMatch: ignore un ancien joueur incompatible et sert les autres", () => {
  const q = [
    entry("lonely", 2000, 30_000), // le plus ancien, mais trop loin de tout le monde
    entry("a", 1000, 0),
    entry("b", 1010, 0),
    entry("c", 1020, 0),
    entry("d", 1030, 0),
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie sans lui");
  assert(
    !g!.some((e) => e.userId === "lonely"),
    "Le joueur incompatible ne doit pas être dans la partie",
  );
  assert(g!.length === 4, "Les 4 autres doivent jouer ensemble");
});

// ============================================================
// FIND MATCH - FOURCHETTES D'ELO
// ============================================================

test("findMatch: refuse un écart supérieur à la fourchette", () => {
  // Les deux attendent depuis 40s : fourchette ±300, écart de 350
  const q = [entry("a", 1000, 40_000), entry("b", 1350, 40_000)];
  assert(findMatch(q, NOW) === null, "Un écart de 350 doit être refusé à ±300");
});

test("findMatch: accepte un écart exactement égal à la fourchette", () => {
  // Fourchette ±300 à 40s, écart de 300 tout juste
  const q = [entry("a", 1000, 40_000), entry("b", 1300, 40_000)];
  const g = findMatch(q, NOW);
  assert(
    g !== null && g.length === 2,
    "Un écart égal à la fourchette doit passer",
  );
});

test("findMatch: la fourchette s'élargit avec l'attente", () => {
  // Écart de 340 : refusé à 40s (±300), accepté à 50s (±350)
  const at40 = [entry("a", 1000, 40_000), entry("b", 1340, 40_000)];
  assert(findMatch(at40, NOW) === null, "Doit refuser à ±300");

  const at50 = [entry("a", 1000, 50_000), entry("b", 1340, 50_000)];
  assert(findMatch(at50, NOW) !== null, "Doit accepter à ±350");
});

test("findMatch: le joueur qui vient d'arriver limite le groupe avec sa fourchette", () => {
  // a attend depuis 40s (±300) et accepte 2 joueurs, mais b vient d'arriver (±100)
  const q = [entry("a", 1000, 40_000), entry("b", 1250, 0)];
  assert(
    findMatch(q, NOW) === null,
    "b ne doit pas être mis avec quelqu'un hors de sa propre fourchette",
  );

  // 30s plus tard pour b : sa fourchette passe à ±250
  const later = [entry("a", 1000, 70_000), entry("b", 1250, 30_000)];
  assert(findMatch(later, NOW) !== null, "Doit matcher quand b s'est élargi");
});

test("findMatch: plafond à ±500, même après une très longue attente", () => {
  const ok = [entry("a", 1000, 3_600_000), entry("b", 1500, 3_600_000)];
  assert(findMatch(ok, NOW) !== null, "Un écart de 500 doit passer au plafond");

  const tooFar = [entry("a", 1000, 3_600_000), entry("b", 1501, 3_600_000)];
  assert(
    findMatch(tooFar, NOW) === null,
    "Un écart de 501 ne doit jamais passer",
  );
});

test("findMatch: un groupe ne contient que des joueurs compatibles entre eux", () => {
  // a est compatible avec b et c séparément, mais b et c sont trop loin l'un de l'autre
  const q = [
    entry("a", 1000, 40_000), // ±300
    entry("b", 920, 0), // ±100
    entry("c", 1080, 0), // ±100
  ];
  const g = findMatch(q, NOW);
  assert(g !== null, "Doit trouver une partie à 2");
  assert(g!.length === 2, "b et c ne doivent pas être ensemble (écart de 160)");
  assert(
    g!.some((e) => e.userId === "a"),
    "a doit jouer",
  );
});

// ============================================================
// FIND MATCH - PURETÉ ET PROPRIÉTÉS
// ============================================================

test("findMatch: ne modifie pas la file", () => {
  const q = [
    entry("c", 1020, 5_000),
    entry("a", 1000, 0),
    entry("b", 1010, 50_000),
    entry("d", 1030, 1_000),
  ];
  const before = q.map((e) => ({ ...e }));
  findMatch(q, NOW);
  assert(q.length === before.length, "La file ne doit pas changer de taille");
  for (let i = 0; i < q.length; i++) {
    assert(
      q[i].userId === before[i].userId && q[i].joinedAt === before[i].joinedAt,
      "L'ordre et le contenu de la file ne doivent pas changer",
    );
  }
});

test("findMatch: même entrée → même résultat (déterministe)", () => {
  const q = [
    entry("a", 1000, 25_000),
    entry("b", 1040, 3_000),
    entry("c", 1080, 8_000),
    entry("d", 1500, 60_000),
  ];
  const r1 = ids(findMatch(q, NOW)).join();
  const r2 = ids(findMatch(q, NOW)).join();
  assert(r1 === r2, "findMatch doit être déterministe");
});

test("findMatch: le groupe ne contient que des joueurs de la file, sans doublon", () => {
  const q = [
    entry("a", 1000),
    entry("b", 1010),
    entry("c", 1020),
    entry("d", 1030),
  ];
  const g = findMatch(q, NOW)!;
  const idSet = new Set(g.map((e) => e.userId));
  assert(idSet.size === g.length, "Pas de doublon");
  assert(
    g.every((e) => q.some((x) => x.userId === e.userId)),
    "Tous les joueurs doivent venir de la file",
  );
});

test("findMatch: propriétés sur 500 files aléatoires", () => {
  for (let run = 0; run < 500; run++) {
    const size = Math.floor(Math.random() * 12);
    const q: QueueEntry[] = [];
    for (let i = 0; i < size; i++) {
      q.push(
        entry(
          `p${i}`,
          600 + Math.floor(Math.random() * 1200),
          Math.floor(Math.random() * 90_000),
        ),
      );
    }

    const g = findMatch(q, NOW);
    if (!g) continue;

    assert(g.length >= 2, `Run ${run} : partie à ${g.length} joueur`);
    assert(
      g.length <= TARGET_PLAYERS,
      `Run ${run} : partie à ${g.length} joueurs`,
    );

    const smallestRange = Math.min(...g.map((e) => eloRange(e, NOW)));
    assert(
      spread(g) <= smallestRange,
      `Run ${run} : écart ${spread(g)} > fourchette ${smallestRange}`,
    );

    const idSet = new Set(g.map((e) => e.userId));
    assert(idSet.size === g.length, `Run ${run} : doublon dans le groupe`);

    // Le groupe doit être assez grand pour au moins un de ses membres
    assert(
      g.some((e) => g.length >= minPlayers(e, NOW)),
      `Run ${run} : groupe de ${g.length} trop petit pour tous ses membres`,
    );
  }
});

// ============================================================
// RÉSULTATS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
