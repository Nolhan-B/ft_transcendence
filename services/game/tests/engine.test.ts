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
// RÉSULTATS
// ============================================================

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
