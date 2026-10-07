import { createGame, playCard, drawCard } from '../src/engine/game-state.js';
import { GameMode, GameStatus } from 'shared';
import type { InternalGameState } from '../src/engine/game-state.js';

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
  assert(
    state.drawPile.length === 79,
    `Pioche doit avoir 79 cartes, a ${state.drawPile.length}`,
  );
});

test('createGame: top card jamais wild', () => {
  for (let i = 0; i < 50; i++) {
    const state = createGame(
      [
        { id: '1', username: 'A' },
        { id: '2', username: 'B' },
      ],
      GameMode.CLASSIC,
    );
    assert(state.topCard.color !== 'wild', `Top card wild au run ${i}`);
  }
});

test('createGame: 108 cartes au total', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const total =
    state.players.reduce((sum, p) => sum + p.hand.length, 0) +
    state.drawPile.length +
    state.discardPile.length;
  assert(total === 108, `Total doit être 108, a ${total}`);
});

test('createGame: settings par défaut', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  assert(state.settings.stacking === false, 'stacking doit être false');
  assert(state.settings.multiplePlay === false, 'multiplePlay doit être false');
  assert(
    state.settings.sevenZeroRule === false,
    'sevenZeroRule doit être false',
  );
  assert(state.settings.jumpIn === false, 'jumpIn doit être false');
  assert(
    state.settings.bluffChallenge === false,
    'bluffChallenge doit être false',
  );
  assert(state.settings.unoCallout === false, 'unoCallout doit être false');
});

test('createGame: settings custom', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
    {
      stacking: true,
      multiplePlay: false,
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    },
  );
  assert(state.settings.stacking === true, 'stacking doit être true');
});

// === PLAY CARD - VALIDATIONS ===

test("playCard: refuse si ce n'est pas le tour du joueur", () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  // Force une carte jouable dans la main de B
  const playableCard = {
    id: 'forced',
    color: state.currentColor,
    value: state.topCard.value,
  };
  state.players[1].hand.push(playableCard);
  const result = playCard(state, '2', 'forced');
  assert(result === null, 'Doit refuser');
});

test('playCard: refuse une carte inexistante', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  const result = playCard(state, '1', 'carte-qui-existe-pas');
  assert(result === null, 'Doit refuser carte inexistante');
});

test('playCard: refuse une carte invalide (mauvaise couleur et valeur)', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  // Force la top card et la main
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'bad', color: 'blue', value: '3' }];
  const result = playCard(state, '1', 'bad');
  assert(result === null, 'Doit refuser carte invalide');
});

test('playCard: accepte même couleur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'good', color: 'red', value: '3' }];
  const result = playCard(state, '1', 'good');
  assert(result !== null, 'Doit accepter');
  assert(result!.topCard.id === 'good', 'Top card doit être la carte jouée');
});

test('playCard: accepte même valeur couleur différente', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'good', color: 'blue', value: '5' }];
  const result = playCard(state, '1', 'good');
  assert(result !== null, 'Doit accepter même valeur');
  assert(result!.currentColor === 'blue', 'Couleur doit changer en blue');
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

test('playCard: refuse si partie terminée', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.status = GameStatus.FINISHED;
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'good', color: 'red', value: '3' }];
  const result = playCard(state, '1', 'good');
  assert(result === null, 'Doit refuser si partie terminée');
});

// === WILD ===

test('playCard: wild change la couleur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: 'w', color: 'wild', value: 'wild' }];
  const result = playCard(state, '1', 'w', 'green');
  assert(result !== null, 'Doit accepter wild');
  assert(result!.currentColor === 'green', 'Couleur doit être green');
});

test('playCard: wild refuse sans chosenColor', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: 'w', color: 'wild', value: 'wild' }];
  const result = playCard(state, '1', 'w');
  assert(result === null, 'Doit refuser wild sans couleur');
});

test('playCard: wild_draw4 fait piocher 4 et change la couleur', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: 'wd', color: 'wild', value: 'wild_draw4' }];
  const bobHandBefore = state.players[1].hand.length;
  const result = playCard(state, '1', 'wd', 'yellow');
  assert(result !== null, 'Doit accepter wild_draw4');
  assert(result!.currentColor === 'yellow', 'Couleur doit être yellow');
  assert(
    state.players[1].hand.length === bobHandBefore + 4,
    'B doit avoir +4 cartes',
  );
});

test('playCard: wild_draw4 refuse sans chosenColor', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].hand = [{ id: 'wd', color: 'wild', value: 'wild_draw4' }];
  const result = playCard(state, '1', 'wd');
  assert(result === null, 'Doit refuser wild_draw4 sans couleur');
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
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 's', color: 'red', value: 'skip' }];
  playCard(state, '1', 's');
  assert(
    state.players[2].isCurrentTurn === true,
    'Doit sauter B, au tour de C',
  );
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
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'r', color: 'red', value: 'reverse' }];
  playCard(state, '1', 'r');
  assert(state.direction === -1, 'Direction doit être -1');
  assert(
    state.players[2].isCurrentTurn === true,
    'Au tour de C (direction inversée)',
  );
});

test('playCard: reverse à 2 joueurs agit comme skip', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [
    { id: 'r', color: 'red', value: 'reverse' },
    { id: 'extra', color: 'red', value: '3' },
  ];
  playCard(state, '1', 'r');
  // Avec 2 joueurs, reverse + advance = retour au même joueur
  assert(
    state.players[0].isCurrentTurn === true,
    'Avec 2 joueurs, reverse doit revenir à A',
  );
});

test('playCard: draw2 fait piocher 2 au suivant et saute son tour', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'd', color: 'red', value: 'draw2' }];
  const bobHandBefore = state.players[1].hand.length;
  playCard(state, '1', 'd');
  assert(
    state.players[1].hand.length === bobHandBefore + 2,
    'B doit avoir +2 cartes',
  );
  assert(
    state.players[2].isCurrentTurn === true,
    'Au tour de C (B a perdu son tour)',
  );
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

test('drawCard: refuse joueur déconnecté', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  state.players[0].disconnected = true;
  const result = drawCard(state, '1');
  assert(result === null, 'Doit refuser joueur déconnecté');
});

test('drawCard: pioche reconstruit le deck depuis la défausse', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
    ],
    GameMode.CLASSIC,
  );
  // Vide la pioche
  state.discardPile.push(...state.drawPile);
  state.drawPile = [];
  state.drawPileCount = 0;
  const discardBefore = state.discardPile.length;
  const result = drawCard(state, '1');
  assert(result !== null, 'Doit réussir');
  assert(
    state.drawPile.length > 0 || state.players[0].hand.length === 8,
    'Doit avoir pioché',
  );
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

test("ranked: le classement est dans l'ordre de sortie", () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.RANKED,
  );
  // A finit en premier
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'c1', color: 'red', value: '3' }];
  playCard(state, '1', 'c1');
  assert(state.ranking[0] === '1', 'A doit être 1er');
  assert(state.status === GameStatus.IN_PROGRESS, 'Partie continue');

  // B finit en deuxième
  state.currentColor = 'red';
  state.players[1].hand = [{ id: 'c2', color: 'red', value: '7' }];
  state.players[1].isCurrentTurn = true;
  playCard(state, '2', 'c2');
  assert(state.ranking[1] === '2', 'B doit être 2ème');
  assert(state.ranking.length === 3, 'Ranking complet');
  assert(state.status === GameStatus.FINISHED, 'Partie terminée');
  assert(state.winnerId === '1', 'A reste le gagnant');
});

// === VICTOIRE CLASSIC ===

test('classic: la partie se termine au premier gagnant', () => {
  const state = createGame(
    [
      { id: '1', username: 'A' },
      { id: '2', username: 'B' },
      { id: '3', username: 'C' },
    ],
    GameMode.CLASSIC,
  );
  state.topCard = { id: 'top', color: 'red', value: '5' };
  state.currentColor = 'red';
  state.players[0].hand = [{ id: 'c1', color: 'red', value: '3' }];
  const result = playCard(state, '1', 'c1');
  assert(result !== null, 'Doit réussir');
  assert(result!.status === GameStatus.FINISHED, 'Partie terminée');
  assert(result!.winnerId === '1', 'A gagne');
  assert(result!.ranking.length === 1, 'Ranking a 1 seul joueur en classic');
});

// === RÉSULTATS ===
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
