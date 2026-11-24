import {
  createGame,
  playCard,
  drawCard,
  advanceToNextPlayer,
  drawCardsForPlayer,
} from "../src/engine/game-state.js";
import { GameMode, GameStatus } from "shared";
import type { InternalGameState } from "../src/engine/game-state.js";

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

// ============================================================
// CREATION
// ============================================================

test("createGame: crée une partie avec 2 joueurs", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  assert(state.players.length === 2, "Doit avoir 2 joueurs");
  assert(state.players[0].hand.length === 7, "Joueur 1 doit avoir 7 cartes");
  assert(state.players[1].hand.length === 7, "Joueur 2 doit avoir 7 cartes");
  assert(
    state.status === GameStatus.IN_PROGRESS,
    "Status doit être IN_PROGRESS",
  );
  assert(state.topCard.color !== "wild", "Top card ne doit pas être wild");
  assert(state.drawPile.length > 0, "Pioche ne doit pas être vide");
  assert(state.direction === 1, "Direction initiale doit être 1");
  assert(state.players[0].isCurrentTurn === true, "Joueur 1 doit commencer");
  assert(
    state.players[1].isCurrentTurn === false,
    "Joueur 2 ne doit pas jouer",
  );
  assert(state.pendingDrawCount === 0, "pendingDrawCount doit être 0");
  assert(
    state.lastWildDraw4 === undefined,
    "lastWildDraw4 doit être undefined",
  );
});

test("createGame: crée une partie avec 4 joueurs", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
      { id: "4", username: "D" },
    ],
    GameMode.CLASSIC,
  );
  assert(state.players.length === 4, "Doit avoir 4 joueurs");
  assert(
    state.drawPileCount === state.drawPile.length,
    "drawPileCount doit correspondre",
  );
  assert(
    state.drawPile.length === 79,
    `Pioche doit avoir 79 cartes, a ${state.drawPile.length}`,
  );
});

test("createGame: top card jamais wild", () => {
  for (let i = 0; i < 50; i++) {
    const state = createGame(
      [
        { id: "1", username: "A" },
        { id: "2", username: "B" },
      ],
      GameMode.CLASSIC,
    );
    assert(state.topCard.color !== "wild", `Top card wild au run ${i}`);
  }
});

test("createGame: 108 cartes au total", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  const total =
    state.players.reduce((sum, p) => sum + p.hand.length, 0) +
    state.drawPile.length +
    state.discardPile.length;
  assert(total === 108, `Total doit être 108, a ${total}`);
});

test("createGame: settings par défaut", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  assert(state.settings.stacking === "none", "stacking doit être none");
  assert(
    state.settings.sevenZeroRule === false,
    "sevenZeroRule doit être false",
  );
  assert(state.settings.jumpIn === false, "jumpIn doit être false");
  assert(
    state.settings.bluffChallenge === false,
    "bluffChallenge doit être false",
  );
  assert(state.settings.unoCallout === false, "unoCallout doit être false");
});

test("createGame: settings custom", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "all",
      sevenZeroRule: true,
      jumpIn: true,
      bluffChallenge: true,
      unoCallout: true,
    },
  );
  assert(state.settings.stacking === "all", "stacking doit être all");
  assert(state.settings.sevenZeroRule === true, "sevenZeroRule doit être true");
  assert(state.settings.jumpIn === true, "jumpIn doit être true");
  assert(
    state.settings.bluffChallenge === true,
    "bluffChallenge doit être true",
  );
  assert(state.settings.unoCallout === true, "unoCallout doit être true");
});

// ============================================================
// PLAY CARD - VALIDATIONS
// ============================================================

test("playCard: refuse si ce n'est pas le tour du joueur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  const playableCard = {
    id: "forced",
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[1].hand.push(playableCard);
  const result = playCard(state, "2", "forced");
  assert(result === null, "Doit refuser");
});

test("playCard: refuse une carte inexistante", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  const result = playCard(state, "1", "carte-qui-existe-pas");
  assert(result === null, "Doit refuser carte inexistante");
});

test("playCard: refuse une carte invalide (mauvaise couleur et valeur)", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "bad", color: "blue", value: "3" }];
  const result = playCard(state, "1", "bad");
  assert(result === null, "Doit refuser carte invalide");
});

test("playCard: accepte même couleur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "good", color: "red", value: "3" }];
  const result = playCard(state, "1", "good");
  assert(result !== null, "Doit accepter");
  assert(result!.topCard.id === "good", "Top card doit être la carte jouée");
});

test("playCard: accepte même valeur couleur différente", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "good", color: "blue", value: "5" }];
  const result = playCard(state, "1", "good");
  assert(result !== null, "Doit accepter même valeur");
  assert(result!.currentColor === "blue", "Couleur doit changer en blue");
});

test("playCard: refuse joueur déconnecté", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].disconnected = true;
  const card = state.players[0].hand[0];
  const result = playCard(state, "1", card.id);
  assert(result === null, "Doit refuser joueur déconnecté");
});

test("playCard: refuse si partie terminée", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.status = GameStatus.FINISHED;
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "good", color: "red", value: "3" }];
  const result = playCard(state, "1", "good");
  assert(result === null, "Doit refuser si partie terminée");
});

// ============================================================
// WILD
// ============================================================

test("playCard: wild change la couleur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: "w", color: "wild", value: "wild" }];
  const result = playCard(state, "1", "w", "green");
  assert(result !== null, "Doit accepter wild");
  assert(result!.currentColor === "green", "Couleur doit être green");
});

test("playCard: wild refuse sans chosenColor", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: "w", color: "wild", value: "wild" }];
  const result = playCard(state, "1", "w");
  assert(result === null, "Doit refuser wild sans couleur");
});

test("playCard: wild refuse couleur invalide", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: "w", color: "wild", value: "wild" }];
  const result = playCard(state, "1", "w", "purple");
  assert(result === null, "Doit refuser couleur invalide");
});

test("playCard: wild_draw4 fait piocher 4 et change la couleur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: "wd", color: "wild", value: "wild_draw4" }];
  const bobHandBefore = state.players[1].hand.length;
  const result = playCard(state, "1", "wd", "yellow");
  assert(result !== null, "Doit accepter wild_draw4");
  assert(result!.currentColor === "yellow", "Couleur doit être yellow");
  assert(
    state.players[1].hand.length === bobHandBefore + 4,
    "B doit avoir +4 cartes",
  );
});

test("playCard: wild_draw4 refuse sans chosenColor", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: "wd", color: "wild", value: "wild_draw4" }];
  const result = playCard(state, "1", "wd");
  assert(result === null, "Doit refuser wild_draw4 sans couleur");
});

// ============================================================
// EFFETS
// ============================================================

test("playCard: skip saute le joueur suivant", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "s", color: "red", value: "skip" }];
  playCard(state, "1", "s");
  assert(
    state.players[2].isCurrentTurn === true,
    "Doit sauter B, au tour de C",
  );
});

test("playCard: reverse inverse la direction", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "r", color: "red", value: "reverse" }];
  playCard(state, "1", "r");
  assert(state.direction === -1, "Direction doit être -1");
  assert(
    state.players[2].isCurrentTurn === true,
    "Au tour de C (direction inversée)",
  );
});

test("playCard: reverse à 2 joueurs agit comme skip", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "r", color: "red", value: "reverse" },
    { id: "extra", color: "red", value: "3" },
  ];
  playCard(state, "1", "r");
  assert(
    state.players[0].isCurrentTurn === true,
    "Avec 2 joueurs, reverse doit revenir à A",
  );
});

test("playCard: draw2 fait piocher 2 au suivant et saute son tour", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "d", color: "red", value: "draw2" }];
  const bobHandBefore = state.players[1].hand.length;
  playCard(state, "1", "d");
  assert(
    state.players[1].hand.length === bobHandBefore + 2,
    "B doit avoir +2 cartes",
  );
  assert(
    state.players[2].isCurrentTurn === true,
    "Au tour de C (B a perdu son tour)",
  );
});

// ============================================================
// DRAW CARD
// ============================================================

test("drawCard: joueur pioche une carte", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  const handBefore = state.players[0].hand.length;
  const pileBefore = state.drawPile.length;
  const result = drawCard(state, "1");
  assert(result !== null, "Doit réussir");
  assert(
    state.players[0].hand.length === handBefore + 1,
    "Main doit avoir +1 carte",
  );
  assert(
    state.drawPile.length === pileBefore - 1,
    "Pioche doit avoir -1 carte",
  );
});

test("drawCard: refuse si pas le tour du joueur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  const result = drawCard(state, "2");
  assert(result === null, "Doit refuser");
});

test("drawCard: passe au joueur suivant après pioche", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  drawCard(state, "1");
  assert(state.players[1].isCurrentTurn === true, "Doit être au tour de B");
});

test("drawCard: refuse joueur déconnecté", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].disconnected = true;
  const result = drawCard(state, "1");
  assert(result === null, "Doit refuser joueur déconnecté");
});

test("drawCard: pioche reconstruit le deck depuis la défausse", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
  );
  state.discardPile.push(...state.drawPile);
  state.drawPile = [];
  state.drawPileCount = 0;
  const result = drawCard(state, "1");
  assert(result !== null, "Doit réussir");
  assert(
    state.drawPile.length > 0 || state.players[0].hand.length === 8,
    "Doit avoir pioché",
  );
});

// ============================================================
// MODE RANKED
// ============================================================

test("ranked: la partie continue après un gagnant", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.RANKED,
  );
  const playableCard = {
    id: "test-card",
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[0].hand = [playableCard];
  const result = playCard(state, "1", "test-card");
  assert(result !== null, "Doit réussir");
  assert(result!.ranking.length === 1, "Un joueur dans le ranking");
  assert(result!.ranking[0] === "1", "A doit être premier");
  assert(result!.status === GameStatus.IN_PROGRESS, "Partie doit continuer");
});

test("ranked: la partie se termine quand il reste 1 joueur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.RANKED,
  );
  const playableCard = {
    id: "test-card",
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[0].hand = [playableCard];
  const result = playCard(state, "1", "test-card");
  assert(result !== null, "Doit réussir");
  assert(result!.status === GameStatus.FINISHED, "Partie doit être terminée");
  assert(result!.winnerId === "1", "A doit être le gagnant");
});

test("ranked: le classement est dans l'ordre de sortie", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.RANKED,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "c1", color: "red", value: "3" }];
  playCard(state, "1", "c1");
  assert(state.ranking[0] === "1", "A doit être 1er");
  assert(state.status === GameStatus.IN_PROGRESS, "Partie continue");

  state.currentColor = "red";
  state.players[1].hand = [{ id: "c2", color: "red", value: "7" }];
  state.players[1].isCurrentTurn = true;
  playCard(state, "2", "c2");
  assert(state.ranking[1] === "2", "B doit être 2ème");
  assert(state.ranking.length === 3, "Ranking complet");
  assert(state.status === GameStatus.FINISHED, "Partie terminée");
  assert(state.winnerId === "1", "A reste le gagnant");
});

// ============================================================
// VICTOIRE CLASSIC
// ============================================================

test("classic: la partie se termine au premier gagnant", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "c1", color: "red", value: "3" }];
  const result = playCard(state, "1", "c1");
  assert(result !== null, "Doit réussir");
  assert(result!.status === GameStatus.FINISHED, "Partie terminée");
  assert(result!.winnerId === "1", "A gagne");
  assert(result!.ranking.length === 1, "Ranking a 1 seul joueur en classic");
});

// ============================================================
// STACKING
// ============================================================

test("stacking none: draw2 fait piocher immédiatement", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "d", color: "red", value: "draw2" }];
  const bobBefore = state.players[1].hand.length;
  playCard(state, "1", "d");
  assert(
    state.players[1].hand.length === bobBefore + 2,
    "B doit piocher 2 immédiatement",
  );
  assert(state.pendingDrawCount === 0, "pendingDrawCount doit rester 0");
});

test("stacking same: draw2 accumule pendingDrawCount", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "same",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "d1", color: "red", value: "draw2" }];
  playCard(state, "1", "d1");
  assert(state.pendingDrawCount === 2, "pendingDrawCount doit être 2");
  assert(state.players[1].isCurrentTurn === true, "Au tour de B");
});

test("stacking same: B peut répondre avec un draw2", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "same",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "d1", color: "red", value: "draw2" },
    { id: "keep", color: "blue", value: "1" },
  ];
  playCard(state, "1", "d1");

  state.players[1].hand = [
    { id: "d2", color: "blue", value: "draw2" },
    { id: "extra", color: "green", value: "5" },
  ];
  const result = playCard(state, "2", "d2");
  assert(result !== null, "B doit pouvoir jouer un draw2");
  assert(state.pendingDrawCount === 4, "pendingDrawCount doit être 4");
  assert(state.players[2].isCurrentTurn === true, "Au tour de C");
});

test("stacking same: B ne peut pas jouer une carte normale quand pendingDrawCount > 0", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "same",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "d1", color: "red", value: "draw2" }];
  playCard(state, "1", "d1");

  state.players[1].hand = [{ id: "normal", color: "red", value: "3" }];
  const result = playCard(state, "2", "normal");
  assert(result === null, "B ne doit pas pouvoir jouer une carte normale");
});

test("stacking same: B ne peut pas stacker un wild_draw4 sur un draw2", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "same",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "d1", color: "red", value: "draw2" },
    { id: "keep", color: "blue", value: "1" },
  ];
  playCard(state, "1", "d1");

  state.players[1].hand = [{ id: "wd", color: "wild", value: "wild_draw4" }];
  const result = playCard(state, "2", "wd", "blue");
  assert(
    result === null,
    "B ne doit pas pouvoir stacker +4 sur +2 en mode same",
  );
});

test("stacking all: B peut stacker un wild_draw4 sur un draw2", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "all",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "d1", color: "red", value: "draw2" },
    { id: "keep", color: "blue", value: "1" },
  ];
  playCard(state, "1", "d1");

  state.players[1].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "extra", color: "green", value: "1" },
  ];
  const result = playCard(state, "2", "wd", "blue");
  assert(result !== null, "B doit pouvoir stacker +4 sur +2 en mode all");
  assert(state.pendingDrawCount === 6, "pendingDrawCount doit être 6");
});

test("stacking: drawCard pioche le pendingDrawCount total", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "same",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "d1", color: "red", value: "draw2" }];
  playCard(state, "1", "d1");

  const bobBefore = state.players[1].hand.length;
  drawCard(state, "2");
  assert(state.players[1].hand.length === bobBefore + 2, "B doit piocher 2");
  assert(state.pendingDrawCount === 0, "pendingDrawCount doit être reset à 0");
});

// ============================================================
// SEVEN ZERO RULE
// ============================================================

test("sevenZeroRule: 7 échange les mains entre deux joueurs", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  const aliceHand = [
    { id: "s7", color: "red", value: "7" },
    { id: "a2", color: "blue", value: "3" },
  ];
  const bobHand = [
    { id: "b1", color: "green", value: "1" },
    { id: "b2", color: "yellow", value: "9" },
  ];
  state.players[0].hand = [...aliceHand];
  state.players[1].hand = [...bobHand];

  playCard(state, "1", "s7", undefined, "2");

  // Après le swap, Alice a la main de Bob (moins la carte jouée)
  assert(
    state.players[0].hand.length === 2,
    "A doit avoir 2 cartes (main de B)",
  );
  assert(
    state.players[0].hand.some((c) => c.id === "b1"),
    "A doit avoir la carte b1 de B",
  );
  assert(
    state.players[1].hand.length === 1,
    "B doit avoir 1 carte (main de A moins le 7)",
  );
  assert(
    state.players[1].hand.some((c) => c.id === "a2"),
    "B doit avoir la carte a2 de A",
  );
});

test("sevenZeroRule: 7 refuse sans targetUserId", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "s7", color: "red", value: "7" }];
  const result = playCard(state, "1", "s7");
  assert(result === null, "Doit refuser 7 sans target");
});

test("sevenZeroRule: 7 refuse target déconnecté", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "s7", color: "red", value: "7" }];
  state.players[1].disconnected = true;
  const result = playCard(state, "1", "s7", undefined, "2");
  assert(result === null, "Doit refuser target déconnecté");
});

test("sevenZeroRule: 0 fait tourner les mains (direction 1)", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";

  state.players[0].hand = [
    { id: "z", color: "red", value: "0" },
    { id: "a1", color: "blue", value: "1" },
  ];
  state.players[1].hand = [{ id: "b1", color: "green", value: "2" }];
  state.players[2].hand = [{ id: "c1", color: "yellow", value: "3" }];

  playCard(state, "1", "z");

  // Direction 1 : A reçoit main de C, B reçoit main de A, C reçoit main de B
  assert(
    state.players[0].hand.some((c) => c.id === "c1"),
    "A doit avoir la carte de C",
  );
  assert(
    state.players[1].hand.some((c) => c.id === "a1"),
    "B doit avoir la carte de A",
  );
  assert(
    state.players[2].hand.some((c) => c.id === "b1"),
    "C doit avoir la carte de B",
  );
});

test("sevenZeroRule off: 7 et 0 sont des cartes normales", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "extra", color: "red", value: "1" },
  ];
  const bobBefore = state.players[1].hand.length;
  const result = playCard(state, "1", "s7");
  assert(result !== null, "Doit accepter 7 comme carte normale");
  assert(
    state.players[1].hand.length === bobBefore,
    "B ne doit pas avoir changé de main",
  );
});

// ============================================================
// JUMP IN
// ============================================================

test("jumpIn: permet de jouer hors tour avec carte identique", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: true,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  // C'est le tour de A, mais C a la même carte que la topCard
  state.players[2].hand = [
    { id: "jump", color: "red", value: "5" },
    { id: "extra", color: "blue", value: "1" },
  ];

  const result = playCard(state, "3", "jump");
  assert(result !== null, "C doit pouvoir jump-in");
  assert(result!.topCard.id === "jump", "Top card doit être la carte de C");
});

test("jumpIn: refuse hors tour si carte pas identique", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: true,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  // Même couleur mais valeur différente
  state.players[2].hand = [{ id: "nojump", color: "red", value: "3" }];

  const result = playCard(state, "3", "nojump");
  assert(
    result === null,
    "C ne doit pas pouvoir jump-in avec une carte différente",
  );
});

test("jumpIn off: refuse hors tour même avec carte identique", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[2].hand = [{ id: "jump", color: "red", value: "5" }];

  const result = playCard(state, "3", "jump");
  assert(result === null, "C ne doit pas pouvoir jump-in si jumpIn est off");
});

test("jumpIn: le tour reprend depuis le joueur qui jump-in", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: true,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[2].hand = [
    { id: "jump", color: "red", value: "5" },
    { id: "extra", color: "blue", value: "1" },
  ];

  playCard(state, "3", "jump");
  // Après le jump-in de C, le tour avance depuis C → direction 1 → A
  assert(
    state.players[0].isCurrentTurn === true,
    "Après jump-in de C, au tour de A",
  );
});

// ============================================================
// BLUFF CHALLENGE
// ============================================================

test("bluffChallenge: wild_draw4 ne fait pas piocher immédiatement", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "extra", color: "blue", value: "1" },
  ];
  const bobBefore = state.players[1].hand.length;

  playCard(state, "1", "wd", "blue");

  assert(
    state.players[1].hand.length === bobBefore,
    "B ne doit PAS piocher immédiatement",
  );
  assert(state.lastWildDraw4 !== undefined, "lastWildDraw4 doit être défini");
  assert(
    state.lastWildDraw4!.playerId === "1",
    "lastWildDraw4 doit référencer A",
  );
});

test("bluffChallenge: stocke hadMatchingColor = true si le joueur avait la couleur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  // A a un +4 ET une carte rouge → il bluff
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "redcard", color: "red", value: "3" },
  ];

  playCard(state, "1", "wd", "blue");

  assert(
    state.lastWildDraw4!.hadMatchingColor === true,
    "hadMatchingColor doit être true",
  );
});

test("bluffChallenge: stocke hadMatchingColor = false si le joueur n'avait pas la couleur", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  // A a un +4 mais PAS de carte rouge → pas de bluff
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "bluecard", color: "blue", value: "3" },
  ];

  playCard(state, "1", "wd", "blue");

  assert(
    state.lastWildDraw4!.hadMatchingColor === false,
    "hadMatchingColor doit être false",
  );
});

test("bluffChallenge: stocke previousColor", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "wd", color: "wild", value: "wild_draw4" }];

  playCard(state, "1", "wd", "green");

  assert(
    state.lastWildDraw4!.previousColor === "red",
    "previousColor doit être red",
  );
  assert(state.currentColor === "green", "currentColor doit être green");
});

test("bluffChallenge off: wild_draw4 fait piocher normalement", () => {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand = [{ id: "wd", color: "wild", value: "wild_draw4" }];
  const bobBefore = state.players[1].hand.length;

  playCard(state, "1", "wd", "blue");

  assert(
    state.players[1].hand.length === bobBefore + 4,
    "B doit piocher 4 immédiatement",
  );
  assert(
    state.lastWildDraw4 === undefined,
    "lastWildDraw4 doit rester undefined",
  );
});

// ============================================================
// COUP REFUSÉ = ÉTAT INCHANGÉ
// ============================================================

// Photo de tout ce qu'un coup peut modifier
function snapshot(state: InternalGameState) {
  return {
    hands: state.players.map((p) => p.hand.map((c) => c.id).join(",")),
    topCard: state.topCard.id,
    discard: state.discardPile.length,
    current: state.players.find((p) => p.isCurrentTurn)?.userId,
    color: state.currentColor,
    direction: state.direction,
    pending: state.pendingDrawCount,
    lastWildDraw4: state.lastWildDraw4 === undefined,
  };
}

function assertUnchanged(
  before: ReturnType<typeof snapshot>,
  state: InternalGameState,
) {
  const after = snapshot(state);
  assert(before.topCard === after.topCard, "La carte du dessus a changé");
  assert(before.discard === after.discard, "La défausse a changé");
  assert(before.current === after.current, "Le tour a changé");
  assert(before.color === after.color, "La couleur courante a changé");
  assert(before.direction === after.direction, "La direction a changé");
  assert(before.pending === after.pending, "pendingDrawCount a changé");
  assert(
    before.lastWildDraw4 === after.lastWildDraw4,
    "lastWildDraw4 a changé",
  );
  for (let i = 0; i < before.hands.length; i++) {
    assert(
      before.hands[i] === after.hands[i],
      `La main du joueur ${i + 1} a changé`,
    );
  }
}

const AUDIT_SETTINGS = {
  stacking: "none" as const,
  sevenZeroRule: true,
  jumpIn: true,
  bluffChallenge: false,
  unoCallout: false,
};

function auditGame(nbPlayers = 3) {
  const participants = [
    { id: "1", username: "A" },
    { id: "2", username: "B" },
    { id: "3", username: "C" },
  ].slice(0, nbPlayers);
  const state = createGame(participants, GameMode.CLASSIC, AUDIT_SETTINGS);
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  return state;
}

test("audit: joker sans couleur → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "w", color: "wild", value: "wild" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "w") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: joker avec une couleur invalide → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "w", color: "wild", value: "wild" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "w", "purple") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: +4 sans couleur → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "wd") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: +4 avec une couleur invalide → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "wd", "purple") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: +4 avec la couleur 'wild' → refusé", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(
    playCard(state, "1", "wd", "wild") === null,
    "« wild » n'est pas une couleur jouable",
  );
  assertUnchanged(before, state);
});

test("audit: +4 avec une couleur valide → accepté", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "wd", color: "wild", value: "wild_draw4" },
    { id: "keep", color: "blue", value: "1" },
  ];
  assert(playCard(state, "1", "wd", "green") !== null, "Doit accepter green");
  assert(state.currentColor === "green", "La couleur doit être green");
});

test("audit: 7 sans cible → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "s7") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: 7 avec une cible déconnectée → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "keep", color: "blue", value: "1" },
  ];
  state.players[1].disconnected = true;
  const before = snapshot(state);
  assert(playCard(state, "1", "s7", undefined, "2") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: 7 qui se vise lui-même → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "s7", undefined, "1") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: 7 avec une cible inconnue → refusé, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(
    playCard(state, "1", "s7", undefined, "inconnu") === null,
    "Doit refuser",
  );
  assertUnchanged(before, state);
});

test("audit: 7 avec une cible valide → accepté, les mains sont échangées", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "a1", color: "blue", value: "1" },
  ];
  state.players[1].hand = [{ id: "b1", color: "green", value: "2" }];
  assert(playCard(state, "1", "s7", undefined, "2") !== null, "Doit accepter");
  assert(
    state.players[0].hand.some((c) => c.id === "b1"),
    "A doit avoir la main de B",
  );
  assert(
    state.players[1].hand.some((c) => c.id === "a1"),
    "B doit avoir la main de A",
  );
});

test("audit: carte invalide → refusée, rien ne change", () => {
  const state = auditGame();
  state.players[0].hand = [
    { id: "bad", color: "blue", value: "3" },
    { id: "keep", color: "green", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "1", "bad") === null, "Doit refuser");
  assertUnchanged(before, state);
});

// ---------------- Jump-in ----------------

test("audit: jump-in avec une carte différente → refusé, le tour ne bouge pas", () => {
  const state = auditGame();
  // C'est le tour de A ; C tente de couper avec une carte pas identique
  state.players[2].hand = [
    { id: "nope", color: "red", value: "3" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "3", "nope") === null, "Doit refuser");
  assertUnchanged(before, state);
  assert(state.players[0].isCurrentTurn, "Le tour doit rester à A");
  assert(!state.players[2].isCurrentTurn, "C ne doit pas avoir pris le tour");
});

test("audit: jump-in avec un joker identique mais sans couleur → refusé, le tour ne bouge pas", () => {
  const state = auditGame();
  state.topCard = { id: "topw", color: "wild", value: "wild" };
  state.currentColor = "red";
  state.players[2].hand = [
    { id: "w2", color: "wild", value: "wild" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "3", "w2") === null, "Doit refuser");
  assertUnchanged(before, state);
  assert(state.players[0].isCurrentTurn, "Le tour doit rester à A");
});

test("audit: jump-in avec un 7 identique mais sans cible → refusé, le tour ne bouge pas", () => {
  const state = auditGame();
  state.topCard = { id: "top7", color: "red", value: "7" };
  state.currentColor = "red";
  state.players[2].hand = [
    { id: "s7", color: "red", value: "7" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "3", "s7") === null, "Doit refuser");
  assertUnchanged(before, state);
  assert(state.players[0].isCurrentTurn, "Le tour doit rester à A");
});

test("audit: jump-in désactivé → refusé, le tour ne bouge pas", () => {
  const state = auditGame();
  state.settings = { ...AUDIT_SETTINGS, jumpIn: false };
  state.players[2].hand = [
    { id: "same", color: "red", value: "5" },
    { id: "keep", color: "blue", value: "1" },
  ];
  const before = snapshot(state);
  assert(playCard(state, "3", "same") === null, "Doit refuser");
  assertUnchanged(before, state);
});

test("audit: jump-in valide → accepté, le tour repart du joueur qui coupe", () => {
  const state = auditGame();
  state.players[2].hand = [
    { id: "same", color: "red", value: "5" },
    { id: "keep", color: "blue", value: "1" },
  ];
  assert(playCard(state, "3", "same") !== null, "Doit accepter");
  assert(state.topCard.id === "same", "La carte de C doit être sur la table");
  assert(state.players[0].isCurrentTurn, "Après C, le tour revient à A");
  assert(!state.players[1].isCurrentTurn, "B a été sauté");
});

// ============================================================
// RÉSULTATS
// ============================================================

// ============================================================
// BLUFF CHALLENGE - +4 EN ATTENTE
// ============================================================

function setupPendingWildDraw4(jumpIn = false): InternalGameState {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.players[0].hand.push({ id: "w4", color: "wild", value: "wild_draw4" });
  playCard(state, "1", "w4", "red");
  return state;
}

test("bluff: la cible ne peut pas jouer une carte au lieu de répondre au +4", () => {
  const state = setupPendingWildDraw4();
  assert(!!state.lastWildDraw4, "le +4 doit être en attente");
  assert(state.players[1].isCurrentTurn, "c'est à la cible (B) de répondre");

  state.players[1].hand.push({ id: "r5", color: "red", value: "5" });
  const handSize = state.players[1].hand.length;
  const result = playCard(state, "2", "r5");

  assert(result === null, "le coup doit être refusé");
  assert(state.players[1].hand.length === handSize, "la main de B est intacte");
  assert(!!state.lastWildDraw4, "le +4 est toujours en attente");
});

test("bluff: la cible ne peut pas piocher une carte au lieu de répondre au +4", () => {
  const state = setupPendingWildDraw4();
  const handSize = state.players[1].hand.length;

  assert(drawCard(state, "2") === null, "la pioche doit être refusée");
  assert(state.players[1].hand.length === handSize, "B n'a pas pioché");
  assert(state.players[1].isCurrentTurn, "c'est toujours à B de répondre");
});

test("bluff: pas de jump-in sur un +4 en attente", () => {
  const state = setupPendingWildDraw4(true);
  state.players[2].hand.push({ id: "w4b", color: "wild", value: "wild_draw4" });

  assert(
    playCard(state, "3", "w4b", "blue") === null,
    "le jump-in doit être refusé",
  );
  assert(
    state.lastWildDraw4?.playerId === "1",
    "le +4 en attente n'est pas écrasé",
  );
});

// ============================================================
// REGLE 7-0 - DERNIERE CARTE
// ============================================================

function setupSevenZero(mode: GameMode): InternalGameState {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    mode,
    {
      stacking: "none",
      sevenZeroRule: true,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  return state;
}

test("7-0: poser un 7 en dernière carte fait gagner, sans échange", () => {
  const state = setupSevenZero(GameMode.CLASSIC);
  state.players[0].hand = [{ id: "r7", color: "red", value: "7" }];
  const bHand = state.players[1].hand.length;

  playCard(state, "1", "r7", undefined, "2");

  assert(state.status === GameStatus.FINISHED, "la partie doit être finie");
  assert(state.winnerId === "1", "A doit gagner");
  assert(state.players[0].hand.length === 0, "A n'a plus de carte");
  assert(state.players[1].hand.length === bHand, "la main de B est intacte");
});

test("7-0: poser un 0 en dernière carte fait gagner, sans rotation", () => {
  const state = setupSevenZero(GameMode.CLASSIC);
  state.players[0].hand = [{ id: "r0", color: "red", value: "0" }];
  const hands = state.players.map((p) => p.hand.length);

  playCard(state, "1", "r0");

  assert(state.status === GameStatus.FINISHED, "la partie doit être finie");
  assert(state.winnerId === "1", "A doit gagner");
  assert(
    state.players.every((p, i) => i === 0 || p.hand.length === hands[i]),
    "les mains des autres sont intactes",
  );
});

test("7-0: en ranked, un 7 en dernière carte classe le joueur sans échange", () => {
  const state = setupSevenZero(GameMode.RANKED);
  state.players[0].hand = [{ id: "r7", color: "red", value: "7" }];
  const bHand = state.players[1].hand.length;

  playCard(state, "1", "r7", undefined, "2");

  assert(state.ranking[0] === "1", "A doit être classé premier");
  assert(state.players[1].hand.length === bHand, "la main de B est intacte");
  assert(
    state.status === GameStatus.IN_PROGRESS,
    "la partie continue entre B et C",
  );
});

test("7-0: avec plusieurs cartes, le 7 échange toujours les mains", () => {
  const state = setupSevenZero(GameMode.CLASSIC);
  state.players[0].hand = [
    { id: "r7", color: "red", value: "7" },
    { id: "b1", color: "blue", value: "1" },
  ];
  const bHand = state.players[1].hand.length;

  playCard(state, "1", "r7", undefined, "2");

  assert(state.players[0].hand.length === bHand, "A récupère la main de B");
  assert(state.players[1].hand.length === 1, "B récupère le bleu 1 de A");
});

// ============================================================
// STACKING + BLUFF
// ============================================================

function setupStackingBluff(): InternalGameState {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "all",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: true,
      unoCallout: false,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  return state;
}

test("stacking+bluff: un +4 posé sur un +2 s'ajoute à la pile, sans bluff", () => {
  const state = setupStackingBluff();
  state.players[0].hand.push({ id: "d2", color: "red", value: "draw2" });
  state.players[1].hand.push({ id: "w4", color: "wild", value: "wild_draw4" });

  playCard(state, "1", "d2");
  assert(state.pendingDrawCount === 2, "la pile doit valoir 2");
  playCard(state, "2", "w4", "blue");

  assert(state.lastWildDraw4 === undefined, "pas de fenêtre de bluff");
  assert(state.pendingDrawCount === 6, "la pile doit valoir 6");
  assert(state.players[2].isCurrentTurn, "c'est à C de répondre à la pile");

  const cHand = state.players[2].hand.length;
  drawCard(state, "3");
  assert(state.players[2].hand.length === cHand + 6, "C pioche toute la pile");
  assert(state.pendingDrawCount === 0, "la pile est vidée");
});

test("stacking+bluff: un +4 hors pile ouvre toujours la fenêtre de bluff", () => {
  const state = setupStackingBluff();
  state.players[0].hand.push({ id: "w4", color: "wild", value: "wild_draw4" });

  playCard(state, "1", "w4", "blue");

  assert(!!state.lastWildDraw4, "la fenêtre de bluff doit être ouverte");
  assert(state.pendingDrawCount === 0, "pas de pile en cours");
  assert(state.players[1].isCurrentTurn, "c'est à B de répondre au +4");
});

// ============================================================
// ACTIONS NOTEES (lastActions)
// ============================================================

function setupActions(
  settings: Partial<InternalGameState["settings"]> = {},
): InternalGameState {
  const state = createGame(
    [
      { id: "1", username: "A" },
      { id: "2", username: "B" },
      { id: "3", username: "C" },
    ],
    GameMode.CLASSIC,
    {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
      ...settings,
    },
  );
  state.topCard = { id: "top", color: "red", value: "5" };
  state.currentColor = "red";
  state.players[0].hand.push({ id: "keep", color: "blue", value: "1" });
  return state;
}

test("actions: une carte jouée est notée avec un seq croissant", () => {
  const state = setupActions();
  state.players[0].hand.push({ id: "r3", color: "red", value: "3" });
  state.players[1].hand.push({ id: "r4", color: "red", value: "4" });

  playCard(state, "1", "r3");
  playCard(state, "2", "r4");

  const [a, b] = state.pendingActions;
  assert(a.type === "card_played" && a.userId === "1", "A a joué");
  assert(a.type === "card_played" && a.card.id === "r3", "la carte est notée");
  assert(b.type === "card_played" && b.userId === "2", "puis B a joué");
  assert(b.seq === a.seq + 1, "les seq se suivent");
});

test("actions: un +2 sans stacking note la carte puis la pioche du suivant", () => {
  const state = setupActions();
  state.players[0].hand.push({ id: "d2", color: "red", value: "draw2" });
  const bHand = [...state.players[1].hand];

  playCard(state, "1", "d2");

  const [played, drawn] = state.pendingActions;
  assert(played.type === "card_played", "d'abord la carte jouée");
  assert(drawn.type === "cards_drawn", "puis la pioche");
  if (drawn.type !== "cards_drawn") return;
  assert(drawn.userId === "2" && drawn.count === 2, "B pioche 2 cartes");
  assert(drawn.reason === "draw2", "raison draw2");
  assert(
    drawn.cards!.every((c) => !bHand.includes(c)) &&
      drawn.cards!.every((c) => state.players[1].hand.includes(c)),
    "les cartes notées sont celles ajoutées à la main de B",
  );
});

test("actions: la couleur choisie d'un joker est notée", () => {
  const state = setupActions();
  state.players[0].hand.push({ id: "w", color: "wild", value: "wild" });
  playCard(state, "1", "w", "green");
  const [a] = state.pendingActions;
  assert(
    a.type === "card_played" && a.chosenColor === "green",
    "chosenColor = green",
  );
});

test("actions: un 7 en règle 7-0 note la cible et l'échange", () => {
  const state = setupActions({ sevenZeroRule: true });
  state.players[0].hand.push({ id: "r7", color: "red", value: "7" });
  playCard(state, "1", "r7", undefined, "3");
  const [played, swapped] = state.pendingActions;
  assert(
    played.type === "card_played" && played.targetUserId === "3",
    "la cible du 7 est notée",
  );
  assert(
    swapped.type === "hands_swapped" &&
      swapped.userId === "1" &&
      swapped.targetUserId === "3",
    "l'échange A <-> C est noté",
  );
});

test("actions: pioche volontaire, pile et AFK ont chacune leur raison", () => {
  const voluntary = setupActions();
  drawCard(voluntary, "1");
  const v = voluntary.pendingActions[0];
  assert(
    v.type === "cards_drawn" && v.reason === "voluntary" && v.count === 1,
    "pioche volontaire d'une carte",
  );
  assert(
    v.type === "cards_drawn" &&
      v.cards![0] === voluntary.players[0].hand.at(-1),
    "la carte notée est celle piochée",
  );

  const stack = setupActions({ stacking: "all" });
  stack.players[0].hand.push({ id: "d2", color: "red", value: "draw2" });
  playCard(stack, "1", "d2");
  drawCard(stack, "2");
  const s = stack.pendingActions.at(-1)!;
  assert(
    s.type === "cards_drawn" && s.reason === "stack" && s.count === 2,
    "B subit la pile de 2",
  );

  const afk = setupActions();
  drawCard(afk, "1", true);
  const f = afk.pendingActions[0];
  assert(
    f.type === "cards_drawn" && f.reason === "afk" && f.auto === true,
    "pioche AFK marquée auto",
  );
});

test("actions: le gagnant est noté comme fini, rang 1", () => {
  const state = setupActions();
  state.players[0].hand = [{ id: "last", color: "red", value: "3" }];
  playCard(state, "1", "last");
  const finished = state.pendingActions.at(-1)!;
  assert(
    finished.type === "player_finished" &&
      finished.userId === "1" &&
      finished.rank === 1,
    "A a fini premier",
  );
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
