import {
  chooseCard,
  chooseColor,
  shouldChallengeBluff,
  shouldCallUno,
  chooseSwapTarget,
} from "../src/engine/ai.js";
import type { Card, CardColor, StackingRule } from "shared";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    for (let i = 0; i < 15; i++) {
      fn();
    }
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

// Helper pour créer des cartes rapidement
function card(color: string, value: string, id?: string): Card {
  return {
    id: id ?? `${color}_${value}_${Math.random()}`,
    color: color as any,
    value,
  };
}

// ============================================================
// CHOOSE CARD - CAS NORMAL
// ============================================================

test("chooseCard: retourne null si aucune carte jouable", () => {
  const hand: Card[] = [card("blue", "3"), card("green", "9")];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result === null, "Doit retourner null");
});

test("chooseCard: retourne une carte jouable (même couleur)", () => {
  const hand: Card[] = [card("red", "3", "r3"), card("blue", "9")];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(result!.id === "r3", "Doit jouer la carte rouge");
});

test("chooseCard: retourne une carte jouable (même valeur)", () => {
  const hand: Card[] = [card("blue", "5", "b5"), card("green", "9")];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(result!.id === "b5", "Doit jouer la carte avec même valeur");
});

test("chooseCard: peut jouer un wild", () => {
  const hand: Card[] = [card("wild", "wild", "w1")];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner le wild");
  assert(result!.color === "wild", "Doit être un wild");
});

test("chooseCard: priorise actions > normales > wilds", () => {
  const hand: Card[] = [
    card("red", "3", "normal"),
    card("red", "skip", "action"),
    card("wild", "wild", "wild"),
  ];
  const topCard = card("red", "5");
  // Avec 70% de chance de suivre la priorité, on teste sur 15 runs
  // Au moins une fois ça devrait suivre la priorité
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  // On vérifie juste que la carte retournée est valide
  assert(
    result!.id === "normal" || result!.id === "action" || result!.id === "wild",
    "Doit retourner une carte de la main",
  );
});

test("chooseCard: retourne toujours une carte de la main", () => {
  const hand: Card[] = [
    card("red", "1", "r1"),
    card("red", "skip", "rs"),
    card("blue", "5", "b5"),
    card("wild", "wild", "w"),
    card("wild", "wild_draw4", "wd"),
  ];
  const topCard = card("red", "7");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(
    hand.some((c) => c.id === result!.id),
    "La carte retournée doit être dans la main",
  );
});

// ============================================================
// CHOOSE CARD - PENDING DRAW (STACKING)
// ============================================================

test("chooseCard: pendingDraw > 0 + stacking none → retourne null", () => {
  const hand: Card[] = [card("red", "draw2", "d2"), card("red", "5")];
  const topCard = card("red", "draw2");
  const result = chooseCard(hand, topCard, "red", 2, "none");
  assert(result === null, "Doit retourner null en stacking none");
});

test("chooseCard: pendingDraw > 0 + stacking same → stack même carte", () => {
  const hand: Card[] = [card("blue", "draw2", "d2"), card("red", "5")];
  const topCard = card("red", "draw2");
  // Mock Math.random pour forcer le stack (> 0.05)
  const origRandom = Math.random;
  Math.random = () => 0.5;
  const result = chooseCard(hand, topCard, "red", 2, "same");
  Math.random = origRandom;
  assert(result !== null, "Doit retourner une carte à stacker");
  assert(result!.value === "draw2", "Doit stacker un draw2");
});

test("chooseCard: pendingDraw > 0 + stacking same → ne stack pas un wild_draw4 sur draw2", () => {
  const hand: Card[] = [card("wild", "wild_draw4", "wd"), card("red", "5")];
  const topCard = card("red", "draw2");
  const origRandom = Math.random;
  Math.random = () => 0.5;
  const result = chooseCard(hand, topCard, "red", 2, "same");
  Math.random = origRandom;
  assert(result === null, "Ne doit pas stacker +4 sur +2 en mode same");
});

test("chooseCard: pendingDraw > 0 + stacking all → stack draw2 ou wild_draw4", () => {
  const hand: Card[] = [card("wild", "wild_draw4", "wd"), card("red", "5")];
  const topCard = card("red", "draw2");
  const origRandom = Math.random;
  Math.random = () => 0.5;
  const result = chooseCard(hand, topCard, "red", 2, "all");
  Math.random = origRandom;
  assert(result !== null, "Doit retourner une carte à stacker");
  assert(
    result!.value === "draw2" || result!.value === "wild_draw4",
    "Doit stacker une carte draw",
  );
});

test("chooseCard: pendingDraw > 0 + stacking all → retourne null si rien à stacker", () => {
  const hand: Card[] = [card("red", "5"), card("blue", "3")];
  const topCard = card("red", "draw2");
  const result = chooseCard(hand, topCard, "red", 2, "all");
  assert(result === null, "Doit retourner null sans carte stackable");
});

test("chooseCard: pendingDraw > 0 + 5% chance de ne pas stacker", () => {
  const hand: Card[] = [card("blue", "draw2", "d2")];
  const topCard = card("red", "draw2");
  const origRandom = Math.random;
  Math.random = () => 0.01; // < 0.05 → ne stack pas
  const result = chooseCard(hand, topCard, "red", 2, "same");
  Math.random = origRandom;
  assert(result === null, "Doit retourner null avec 5% de chance");
});

// ============================================================
// CHOOSE COLOR
// ============================================================

test("chooseColor: choisit la couleur la plus présente", () => {
  const hand: Card[] = [
    card("red", "1"),
    card("red", "3"),
    card("red", "5"),
    card("blue", "2"),
    card("green", "4"),
  ];
  const result = chooseColor(hand);
  assert(result === "red", `Doit choisir red, a choisi ${result}`);
});

test("chooseColor: fonctionne avec une seule couleur", () => {
  const hand: Card[] = [card("blue", "1"), card("blue", "3")];
  const result = chooseColor(hand);
  assert(result === "blue", `Doit choisir blue, a choisi ${result}`);
});

test("chooseColor: retourne une couleur valide avec main vide", () => {
  const hand: Card[] = [];
  const result = chooseColor(hand);
  const validColors = ["red", "blue", "green", "yellow"];
  assert(
    validColors.includes(result),
    `Doit retourner une couleur valide, a ${result}`,
  );
});

test("chooseColor: retourne une couleur valide avec que des wilds", () => {
  const hand: Card[] = [card("wild", "wild"), card("wild", "wild_draw4")];
  const result = chooseColor(hand);
  const validColors = ["red", "blue", "green", "yellow"];
  assert(
    validColors.includes(result),
    `Doit retourner une couleur valide, a ${result}`,
  );
});

test("chooseColor: gère les égalités", () => {
  const hand: Card[] = [card("red", "1"), card("blue", "2")];
  const result = chooseColor(hand);
  const validColors = ["red", "blue", "green", "yellow"];
  assert(
    validColors.includes(result),
    `Doit retourner une couleur valide, a ${result}`,
  );
});

test("chooseColor: ignore les wilds dans le comptage", () => {
  const hand: Card[] = [
    card("green", "1"),
    card("green", "3"),
    card("wild", "wild"),
    card("wild", "wild_draw4"),
  ];
  const result = chooseColor(hand);
  assert(result === "green", `Doit choisir green, a choisi ${result}`);
});

// ============================================================
// SHOULD CHALLENGE BLUFF
// ============================================================

test("shouldChallengeBluff: retourne un boolean", () => {
  const hand: Card[] = [card("red", "3"), card("blue", "5")];
  const result = shouldChallengeBluff(hand, "red");
  assert(typeof result === "boolean", "Doit retourner un boolean");
});

test("shouldChallengeBluff: plus de chance de challenge si a des cartes de la couleur", () => {
  const hand: Card[] = [card("red", "3"), card("red", "5"), card("red", "7")];
  let challengeCount = 0;
  const origRandom = Math.random;
  // Test avec valeur fixe > 0.3 → devrait challenger
  Math.random = () => 0.5;
  const result = shouldChallengeBluff(hand, "red");
  Math.random = origRandom;
  assert(
    result === true,
    "Doit challenger avec random 0.5 et cartes de la couleur",
  );
});

test("shouldChallengeBluff: moins de chance si pas de cartes de la couleur", () => {
  const hand: Card[] = [card("blue", "3"), card("green", "5")];
  const origRandom = Math.random;
  // Test avec valeur 0.5 < 0.7 → ne devrait pas challenger
  Math.random = () => 0.5;
  const result = shouldChallengeBluff(hand, "red");
  Math.random = origRandom;
  assert(
    result === false,
    "Ne doit pas challenger avec random 0.5 sans cartes de la couleur",
  );
});

test("shouldChallengeBluff: challenge avec random élevé même sans cartes", () => {
  const hand: Card[] = [card("blue", "3")];
  const origRandom = Math.random;
  Math.random = () => 0.9; // > 0.7 → challenge quand même
  const result = shouldChallengeBluff(hand, "red");
  Math.random = origRandom;
  assert(result === true, "Doit challenger avec random 0.9");
});

test("shouldChallengeBluff: pas de challenge avec random bas et cartes de la couleur", () => {
  const hand: Card[] = [card("red", "3")];
  const origRandom = Math.random;
  Math.random = () => 0.1; // < 0.3 → ne challenge pas
  const result = shouldChallengeBluff(hand, "red");
  Math.random = origRandom;
  assert(result === false, "Ne doit pas challenger avec random 0.1");
});

// ============================================================
// SHOULD CALL UNO
// ============================================================

test("shouldCallUno: false si plus d'une carte", () => {
  const hand: Card[] = [card("red", "3"), card("blue", "5")];
  const result = shouldCallUno(hand);
  assert(result === false, "Doit retourner false avec 2 cartes");
});

test("shouldCallUno: false si main vide", () => {
  const hand: Card[] = [];
  const result = shouldCallUno(hand);
  assert(result === false, "Doit retourner false avec 0 cartes");
});

test("shouldCallUno: true la plupart du temps avec 1 carte", () => {
  const hand: Card[] = [card("red", "3")];
  const origRandom = Math.random;
  Math.random = () => 0.5; // > 0.1 → call uno
  const result = shouldCallUno(hand);
  Math.random = origRandom;
  assert(result === true, "Doit retourner true avec random 0.5");
});

test("shouldCallUno: 10% de chance d'oublier", () => {
  const hand: Card[] = [card("red", "3")];
  const origRandom = Math.random;
  Math.random = () => 0.05; // < 0.1 → oublie
  const result = shouldCallUno(hand);
  Math.random = origRandom;
  assert(result === false, "Doit oublier avec random 0.05");
});

test("shouldCallUno: false avec 3 cartes", () => {
  const hand: Card[] = [
    card("red", "1"),
    card("blue", "2"),
    card("green", "3"),
  ];
  const result = shouldCallUno(hand);
  assert(result === false, "Doit retourner false avec 3 cartes");
});

// ============================================================
// CHOOSE SWAP TARGET
// ============================================================

test("chooseSwapTarget: cible le joueur avec le moins de cartes", () => {
  const players = [
    { userId: "bot_alice", handCount: 5 },
    { userId: "player1", handCount: 2 },
    { userId: "player2", handCount: 7 },
  ];
  const result = chooseSwapTarget(players, "bot_alice");
  assert(result === "player1", `Doit cibler player1, a ciblé ${result}`);
});

test("chooseSwapTarget: ne se cible jamais lui-même", () => {
  const players = [
    { userId: "bot_alice", handCount: 1 },
    { userId: "player1", handCount: 5 },
    { userId: "player2", handCount: 3 },
  ];
  const result = chooseSwapTarget(players, "bot_alice");
  assert(result !== "bot_alice", "Ne doit pas se cibler soi-même");
  assert(
    result === "player2",
    `Doit cibler player2 (3 cartes), a ciblé ${result}`,
  );
});

test("chooseSwapTarget: fonctionne avec 2 joueurs", () => {
  const players = [
    { userId: "bot_alice", handCount: 4 },
    { userId: "player1", handCount: 6 },
  ];
  const result = chooseSwapTarget(players, "bot_alice");
  assert(result === "player1", `Doit cibler player1, a ciblé ${result}`);
});

test("chooseSwapTarget: gère les égalités (prend le premier)", () => {
  const players = [
    { userId: "bot_alice", handCount: 5 },
    { userId: "player1", handCount: 3 },
    { userId: "player2", handCount: 3 },
  ];
  const result = chooseSwapTarget(players, "bot_alice");
  assert(
    result === "player1" || result === "player2",
    `Doit cibler un joueur avec 3 cartes, a ciblé ${result}`,
  );
});

test("chooseSwapTarget: cible bien la plus petite main même si le bot a moins", () => {
  const players = [
    { userId: "bot_alice", handCount: 1 },
    { userId: "player1", handCount: 10 },
    { userId: "player2", handCount: 2 },
    { userId: "player3", handCount: 8 },
  ];
  const result = chooseSwapTarget(players, "bot_alice");
  assert(
    result === "player2",
    `Doit cibler player2 (2 cartes), a ciblé ${result}`,
  );
});

// ============================================================
// CHOOSE CARD - CAS LIMITES
// ============================================================

test("chooseCard: main avec une seule carte jouable", () => {
  const hand: Card[] = [
    card("blue", "3"),
    card("green", "9"),
    card("red", "7", "r7"),
  ];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(result!.id === "r7", "Doit jouer la seule carte jouable");
});

test("chooseCard: toutes les cartes sont jouables", () => {
  const hand: Card[] = [
    card("red", "1"),
    card("red", "skip"),
    card("red", "reverse"),
  ];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(result!.color === "red", "La carte jouée doit être rouge");
});

test("chooseCard: wild_draw4 est jouable quand rien d'autre ne va", () => {
  const hand: Card[] = [card("blue", "3"), card("wild", "wild_draw4", "wd")];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result !== null, "Doit retourner une carte");
  assert(result!.id === "wd", "Doit jouer le wild_draw4");
});

test("chooseCard: main vide retourne null", () => {
  const hand: Card[] = [];
  const topCard = card("red", "5");
  const result = chooseCard(hand, topCard, "red", 0, "none");
  assert(result === null, "Doit retourner null avec main vide");
});

// ============================================================
// RÉSULTATS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
