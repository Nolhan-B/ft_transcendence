import { computeEloChanges, ELO_K } from "../src/engine/elo.js";

// Doit avoir la même valeur que ELO_K dans src/engine/elo.ts.
// Si tu changes K là-bas, change-le ici aussi : toutes les valeurs
// attendues (et les noms des tests) sont recalculées à partir de K.
const K = 16;

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

// Classement du 1er au dernier, à partir d'une liste d'ELO
function ranking(...elos: number[]) {
  return elos.map((elo, i) => ({ userId: `p${i + 1}`, elo }));
}

// Variation d'ELO de chaque joueur, dans l'ordre du classement
function deltas(...elos: number[]): number[] {
  return computeEloChanges(ranking(...elos)).map((c) => c.newElo - c.oldElo);
}

// Probabilité que A batte B (formule ELO standard)
function proba(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

// Variation attendue, avec le même arrondi que la fonction (sur l'ELO final)
function rounded(elo: number, rawDelta: number): number {
  return Math.round(elo + rawDelta) - elo;
}

// Variation attendue à 2 joueurs : le gagnant `winner` bat `loser`
function expectedDuel(winner: number, loser: number): [number, number] {
  const gain = K * (1 - proba(winner, loser));
  return [rounded(winner, gain), rounded(loser, -gain)];
}

// Variations attendues quand tous les joueurs ont le même ELO :
// chaque duel vaut ± K / (n − 1) / 2, et le joueur à la place `i`
// gagne (n − 1 − i) duels et en perd i.
function expectedEqual(elo: number, n: number): number[] {
  const perDuel = K / (n - 1) / 2;
  return Array.from({ length: n }, (_, i) =>
    rounded(elo, perDuel * (n - 1 - i) - perDuel * i),
  );
}

// Affiche une variation avec son signe : +8, 0, −8
function fmt(x: number): string {
  return x > 0 ? `+${x}` : x < 0 ? `−${-x}` : "0";
}
function fmtAll(xs: number[]): string {
  return xs.map(fmt).join(" / ");
}

// Valeurs attendues, calculées à partir de K
const EQUAL_2 = expectedDuel(1000, 1000);
const FAVORITE = expectedDuel(1400, 1000);
const UPSET = expectedDuel(1000, 1400);
const EQUAL_3 = expectedEqual(1000, 3);
const EQUAL_4 = expectedEqual(1000, 4);

// ============================================================
// CAS LIMITES
// ============================================================

test(`elo: K du test (${K}) = ELO_K du code (${ELO_K})`, () => {
  assert(
    ELO_K === K,
    `ELO_K vaut ${ELO_K} dans elo.ts mais K vaut ${K} dans le test : mets la même valeur`,
  );
  assert(K > 0, `K doit être positif, vaut ${K}`);
});

test("elo: classement vide → résultat vide", () => {
  const r = computeEloChanges([]);
  assert(Array.isArray(r) && r.length === 0, "Doit renvoyer un tableau vide");
});

test("elo: un seul joueur → ELO inchangé", () => {
  const r = computeEloChanges(ranking(1234));
  assert(r.length === 1, "Doit renvoyer 1 résultat");
  assert(
    r[0].oldElo === 1234 && r[0].newElo === 1234,
    "L'ELO ne doit pas bouger",
  );
});

test("elo: renvoie un résultat par joueur, dans le même ordre", () => {
  const input = ranking(1000, 1100, 900, 1050);
  const r = computeEloChanges(input);
  assert(r.length === 4, "Doit renvoyer 4 résultats");
  for (let i = 0; i < 4; i++) {
    assert(r[i].userId === input[i].userId, `Ordre incorrect à l'index ${i}`);
    assert(
      r[i].oldElo === input[i].elo,
      `oldElo incorrect pour ${input[i].userId}`,
    );
  }
});

test("elo: ne modifie pas le tableau d'entrée", () => {
  const input = ranking(1000, 1200, 800);
  const copy = input.map((p) => ({ ...p }));
  computeEloChanges(input);
  for (let i = 0; i < input.length; i++) {
    assert(
      input[i].userId === copy[i].userId && input[i].elo === copy[i].elo,
      "L'entrée ne doit pas être modifiée",
    );
  }
});

test("elo: les nouveaux ELO sont des entiers", () => {
  const r = computeEloChanges(ranking(1013, 987, 1222, 845));
  assert(
    r.every((c) => Number.isInteger(c.newElo)),
    "Tous les ELO doivent être entiers",
  );
});

// ============================================================
// DEUX JOUEURS
// ============================================================

test(`elo: 2 joueurs de même niveau → ${fmtAll(EQUAL_2)}`, () => {
  const [win, lose] = EQUAL_2;
  const d = deltas(1000, 1000);
  assert(d[0] === win, `Le gagnant doit gagner ${win}, a gagné ${d[0]}`);
  assert(d[1] === lose, `Le perdant doit perdre ${-lose}, a perdu ${-d[1]}`);
});

test(`elo: victoire attendue (1400 bat 1000) → ${fmtAll(FAVORITE)}`, () => {
  const [win, lose] = FAVORITE;
  const d = deltas(1400, 1000);
  assert(d[0] === win, `Le favori doit gagner ${win}, a gagné ${d[0]}`);
  assert(d[1] === lose, `L'outsider doit perdre ${-lose}, a perdu ${-d[1]}`);
  assert(d[0] < K / 4, `Une victoire attendue doit rapporter peu (${d[0]})`);
});

test(`elo: victoire surprise (1000 bat 1400) → ${fmtAll(UPSET)}`, () => {
  const [win, lose] = UPSET;
  const d = deltas(1000, 1400);
  assert(d[0] === win, `L'outsider doit gagner ${win}, a gagné ${d[0]}`);
  assert(d[1] === lose, `Le favori doit perdre ${-lose}, a perdu ${-d[1]}`);
  assert(d[0] > (K * 3) / 4, `Une surprise doit rapporter beaucoup (${d[0]})`);
});

test("elo: à 2 joueurs, les points sont équilibrés", () => {
  for (const [a, b] of [
    [1000, 1000],
    [1400, 1000],
    [1000, 1400],
    [1234, 987],
    [2000, 1500],
  ]) {
    const d = deltas(a, b);
    // L'arrondi se fait sur chaque ELO : on tolère 1 point d'écart
    assert(
      Math.abs(d[0] + d[1]) <= 1,
      `${a} vs ${b} : gain ${d[0]}, perte ${-d[1]}`,
    );
  }
});

test(`elo: un gain à 2 joueurs ne dépasse jamais K (${K})`, () => {
  const d = deltas(500, 2500);
  assert(d[0] <= K, `Le gain doit rester ≤ ${K}, vaut ${d[0]}`);
  assert(d[0] > 0, "L'outsider doit quand même gagner des points");
});

test("elo: plus l'exploit est grand, plus le gain est grand", () => {
  const small = deltas(1000, 1100)[0];
  const medium = deltas(1000, 1300)[0];
  const big = deltas(1000, 1600)[0];
  assert(
    small <= medium && medium <= big && small < big,
    `Gains non croissants : ${small}, ${medium}, ${big}`,
  );
});

// ============================================================
// PARTIES À PLUSIEURS
// ============================================================

test(`elo: 3 joueurs de même niveau → ${fmtAll(EQUAL_3)}`, () => {
  const expected = EQUAL_3;
  const d = deltas(1000, 1000, 1000);
  assert(
    d.join() === expected.join(),
    `Attendu ${expected.join()}, obtenu ${d.join()}`,
  );
});

test(`elo: 4 joueurs de même niveau → ${fmtAll(EQUAL_4)}`, () => {
  const expected = EQUAL_4;
  const d = deltas(1000, 1000, 1000, 1000);
  assert(
    d.join() === expected.join(),
    `Attendu ${expected.join()}, obtenu ${d.join()}`,
  );
});

test("elo: à niveau égal, chaque place ne rapporte pas plus que la précédente", () => {
  const d = deltas(1200, 1200, 1200, 1200);
  for (let i = 1; i < d.length; i++) {
    assert(d[i] <= d[i - 1], `La place ${i + 1} rapporte plus que la ${i}`);
  }
  assert(d[0] > d[d.length - 1], "Le 1er doit gagner plus que le dernier");
});

test("elo: le 1er gagne toujours des points", () => {
  for (const elos of [
    [2000, 1000, 1000, 1000],
    [800, 1500, 1500, 1500],
    [1000, 1000],
    [3000, 100],
  ]) {
    const d = deltas(...elos);
    assert(
      d[0] >= 0,
      `Le 1er (${elos.join(",")}) ne doit pas perdre de points : ${d[0]}`,
    );
  }
});

test("elo: le dernier perd toujours des points", () => {
  for (const elos of [
    [1000, 1000, 1000, 2000],
    [1500, 1500, 1500, 800],
    [1000, 1000],
  ]) {
    const d = deltas(...elos);
    const last = d[d.length - 1];
    assert(
      last <= 0,
      `Le dernier (${elos.join(",")}) ne doit pas gagner de points : ${last}`,
    );
  }
});

test("elo: un favori qui finit 2e peut perdre des points", () => {
  // 1400 finit 2e derrière un 1000, devant deux 1000
  const d = deltas(1000, 1400, 1000, 1000);
  assert(d[1] < 0, `Le favori 2e doit perdre des points, delta = ${d[1]}`);
});

test("elo: un outsider qui finit 3e peut gagner des points", () => {
  // 800 finit 3e derrière deux 1200, mais devant un 1400
  const d = deltas(1200, 1200, 800, 1400);
  assert(d[2] > 0, `L'outsider 3e doit gagner des points, delta = ${d[2]}`);
});

test(`elo: le gain total du 1er reste ≤ K (${K})`, () => {
  // Même en battant 3 joueurs beaucoup plus forts
  const d = deltas(800, 1600, 1600, 1600);
  assert(d[0] <= K, `Le gain du 1er doit rester ≤ ${K}, vaut ${d[0]}`);
});

test("elo: battre tout le monde rapporte autant à 2 qu'à 4, à niveau égal", () => {
  // K est divisé par (n − 1) : le gain total du 1er ne dépend pas du nombre de joueurs
  const duo = deltas(1000, 1000)[0];
  const quad = deltas(1000, 1000, 1000, 1000)[0];
  assert(duo === quad, `À 2 : +${duo}, à 4 : +${quad}`);
});

// ============================================================
// PLANCHER
// ============================================================

test("elo: ne descend jamais sous 0", () => {
  // Un joueur dont l'ELO est inférieur à ce qu'il va perdre
  const low = Math.max(1, Math.floor(K / 4));
  const r = computeEloChanges(ranking(low, low));
  assert(
    r[1].newElo === 0,
    `Le perdant à ${low} doit tomber à 0, est à ${r[1].newElo}`,
  );
});

test("elo: un joueur à 0 qui perd reste à 0", () => {
  const r = computeEloChanges(ranking(500, 0));
  assert(r[1].newElo === 0, `Doit rester à 0, est à ${r[1].newElo}`);
});

test("elo: un joueur à 0 qui gagne remonte", () => {
  const r = computeEloChanges(ranking(0, 500));
  assert(r[0].newElo > 0, `Doit remonter au-dessus de 0, est à ${r[0].newElo}`);
});

// ============================================================
// PROPRIÉTÉS SUR DES CLASSEMENTS ALÉATOIRES
// ============================================================

test("elo: propriétés sur 1000 classements aléatoires", () => {
  for (let run = 0; run < 1000; run++) {
    const n = 2 + Math.floor(Math.random() * 3); // 2 à 4 joueurs
    const elos = Array.from(
      { length: n },
      () => 600 + Math.floor(Math.random() * 1400),
    );
    const r = computeEloChanges(ranking(...elos));
    const d = r.map((c) => c.newElo - c.oldElo);

    assert(
      r.length === n,
      `Run ${run} : ${r.length} résultats pour ${n} joueurs`,
    );
    assert(
      r.every((c) => Number.isInteger(c.newElo) && c.newElo >= 0),
      `Run ${run} : ELO non entier ou négatif`,
    );
    assert(
      d[0] >= 0,
      `Run ${run} : le 1er perd des points (${elos.join(",")})`,
    );
    assert(
      d[n - 1] <= 0,
      `Run ${run} : le dernier gagne des points (${elos.join(",")})`,
    );

    // Les gains et les pertes s'équilibrent, à l'arrondi près (au plus 0,5 par joueur)
    const sum = d.reduce((a, b) => a + b, 0);
    assert(
      Math.abs(sum) <= n / 2,
      `Run ${run} : somme des variations = ${sum} (${elos.join(",")})`,
    );

    assert(
      d.every((x) => Math.abs(x) <= K),
      `Run ${run} : une variation dépasse K (${d.join(",")})`,
    );
  }
});

// ============================================================
// RÉSULTATS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===  (K = ${K})`);
if (failed > 0) process.exit(1);
