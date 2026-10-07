import { createGame, playCard, drawCard } from './game-state.js';
import { GameMode, GameStatus } from 'shared';

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

// === CREATION ===

test('createGame: crée une partie avec 2 joueurs', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  assert(state.players.length === 2, 'Doit avoir 2 joueurs');
  assert(state.players[0].hand.length === 7, 'Joueur 1 doit avoir 7 cartes');
  assert(state.players[1].hand.length === 7, 'Joueur 2 doit avoir 7 cartes');
  assert(
    state.status === GameStatus.IN_PROGRESS,
    'Status doit être IN_PROGRESS',
  );
  assert(state.topCard.color !== 'wild', 'Top card ne doit pas être wild');
  assert(state.drawPile.length > 0, 'Pioche ne doit pas être vide');
  assert(state.direction === 1, 'Direction initiale doit être 1');
  assert(state.players[0].isCurrentTurn === true, 'Joueur 1 doit commencer');
  assert(
    state.players[1].isCurrentTurn === false,
    'Joueur 2 ne doit pas jouer',
  );
});

test('createGame: crée une partie avec 4 joueurs', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
      { id: '4', username: 'D' },
    ],
    GameMode.CLASSIC,
  );
  assert(state.players.length === 4, 'Doit avoir 4 joueurs');
  assert(
    state.drawPileCount === state.drawPile.length,
    'drawPileCount doit correspondre',
  );
  // 108 - 28 (4x7) - 1 (topCard) = 79
  assert(
    state.drawPile.length === 79,
    `Pioche doit avoir 79 cartes, a ${state.drawPile.length}`,
  );
});

// === PLAY CARD ===

test("playCard: refuse si ce n'est pas le tour du joueur", () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const wrongPlayer = state.players[1];
  const card = wrongPlayer.hand[0];
  const result = playCard(state, wrongPlayer.userId, card.id);
  assert(result === null, 'Doit refuser');
});

test('playCard: refuse une carte invalide (mauvaise couleur et valeur)', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  // Trouve une carte qui ne matche ni couleur ni valeur
  const badCard = player.hand.find(
    (c) =>
      c.color !== state.currentColor &&
      c.value !== state.topCard.value &&
      c.color !== 'wild',
  );
  if (badCard) {
    const result = playCard(state, player.userId, badCard.id);
    assert(result === null, 'Doit refuser carte invalide');
  }
});

test('playCard: accepte une carte de même couleur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const goodCard = player.hand.find((c) => c.color === state.currentColor);
  if (goodCard) {
    const result = playCard(state, player.userId, goodCard.id);
    assert(result !== null, 'Doit accepter carte même couleur');
    assert(
      result!.topCard.id === goodCard.id,
      'Top card doit être la carte jouée',
    );
    assert(player.hand.length === 6, 'Main doit avoir 6 cartes');
  }
});

test('playCard: accepte un wild', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const wild = player.hand.find(
    (c) => c.color === 'wild' && c.value === 'wild',
  );
  if (wild) {
    const result = playCard(state, player.userId, wild.id, 'red');
    assert(result !== null, 'Doit accepter wild');
    assert(result!.currentColor === 'red', 'Couleur doit être red');
  }
});

test('playCard: refuse wild sans chosenColor', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const wild = player.hand.find((c) => c.color === 'wild');
  if (wild) {
    const result = playCard(state, player.userId, wild.id);
    assert(result === null, 'Doit refuser wild sans couleur choisie');
  }
});

test('playCard: refuse joueur déconnecté', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].disconnected = true;
  const card = state.players[0].hand[0];
  const result = playCard(state, '1', card.id);
  assert(result === null, 'Doit refuser joueur déconnecté');
});

// === DRAW CARD ===

test('drawCard: joueur pioche une carte', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const handBefore = state.players[0].hand.length;
  const pileBefore = state.drawPile.length;
  const result = drawCard(state, '1');
  assert(result !== null, 'Doit réussir');
  assert(
    state.players[0].hand.length === handBefore + 1,
    'Main doit avoir +1 carte',
  );
  assert(
    state.drawPile.length === pileBefore - 1,
    'Pioche doit avoir -1 carte',
  );
});

test('drawCard: refuse si pas le tour du joueur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const result = drawCard(state, '2');
  assert(result === null, 'Doit refuser');
});

test('drawCard: passe au joueur suivant après pioche', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  drawCard(state, '1');
  assert(state.players[1].isCurrentTurn === true, 'Doit être au tour de B');
});

// === EFFETS ===

test('playCard: skip saute le joueur suivant', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const skip = player.hand.find(
    (c) =>
      c.value === 'skip' &&
      (c.color === state.currentColor || c.value === state.topCard.value),
  );
  if (skip) {
    playCard(state, '1', skip.id);
    assert(
      state.players[2].isCurrentTurn === true,
      'Doit sauter B, au tour de C',
    );
  }
});

test('playCard: reverse inverse la direction', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const reverse = player.hand.find(
    (c) =>
      c.value === 'reverse' &&
      (c.color === state.currentColor || c.value === state.topCard.value),
  );
  if (reverse) {
    playCard(state, '1', reverse.id);
    assert(state.direction === -1, 'Direction doit être inversée');
  }
});

test('playCard: draw2 fait piocher 2 au suivant', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const player = state.players[0];
  const draw2 = player.hand.find(
    (c) =>
      c.value === 'draw2' &&
      (c.color === state.currentColor || c.value === state.topCard.value),
  );
  if (draw2) {
    const bobHandBefore = state.players[1].hand.length;
    playCard(state, '1', draw2.id);
    assert(
      state.players[1].hand.length === bobHandBefore + 2,
      'B doit avoir +2 cartes',
    );
  }
});

// === MODE RANKED ===

test('ranked: la partie continue après un gagnant', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.RANKED,
  );
  // Force la main de A à une seule carte jouable
  const playableCard = {
    id: 'test-card',
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[0].hand = [playableCard];

  const result = playCard(state, '1', 'test-card');
  assert(result !== null, 'Doit réussir');
  assert(result!.ranking.length === 1, 'Un joueur dans le ranking');
  assert(result!.ranking[0] === '1', 'A doit être premier');
  assert(result!.status === GameStatus.IN_PROGRESS, 'Partie doit continuer');
});

test('ranked: la partie se termine quand il reste 1 joueur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.RANKED,
  );
  const playableCard = {
    id: 'test-card',
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[0].hand = [playableCard];

  const result = playCard(state, '1', 'test-card');
  assert(result !== null, 'Doit réussir');
  assert(result!.status === GameStatus.FINISHED, 'Partie doit être terminée');
  assert(result!.winnerId === '1', 'A doit être le gagnant');
});

// === RÉSULTATS ===
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
