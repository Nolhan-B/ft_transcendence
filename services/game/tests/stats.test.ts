import type { Match } from "shared";
import {
  computeAchievements,
  humanIds,
  toMatch,
  toParticipants,
  type MatchRow,
  type UserInfo,
} from "../src/engine/stats.js";

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

const ME = "me";
let day = 0;

// Une partie enregistree ; les dates avancent d'un jour a chaque appel
function row(over: Partial<MatchRow> = {}): MatchRow {
  day++;
  const players = over.players ?? [ME, "other"];
  return {
    id: `m${day}`,
    mode: "classic",
    players,
    playerNames: players.map((p) => `name_${p}`),
    ranking: [],
    winnerId: "other",
    eloChanges: [],
    startedAt: new Date(Date.UTC(2026, 0, day, 10)),
    endedAt: new Date(Date.UTC(2026, 0, day, 11)),
    ...over,
  };
}

const NO_USERS = new Map<string, UserInfo>();
const match = (over: Partial<MatchRow> = {}): Match =>
  toMatch(row(over), NO_USERS);
const win = (over: Partial<MatchRow> = {}) => match({ winnerId: ME, ...over });
const loss = (over: Partial<MatchRow> = {}) =>
  match({ winnerId: "other", ...over });

const get = (list: ReturnType<typeof computeAchievements>, id: string) =>
  list.find((a) => a.id === id)!;

// ============================================================
// PARTICIPANTS
// ============================================================

test("participants: pseudo et avatar actuels d'un compte", () => {
  const users = new Map([
    ["u1", { id: "u1", username: "renamed", avatarUrl: "/a.png" }],
  ]);
  const [p] = toParticipants(
    row({ players: ["u1"], playerNames: ["old"] }),
    users,
  );
  assert(p.username === "renamed", `pseudo actuel attendu, reçu ${p.username}`);
  assert(p.avatarUrl === "/a.png", "avatar actuel");
  assert(!p.isBot && !p.deleted, "ni bot ni supprimé");
});

test("participants: un bot garde son nom de la partie", () => {
  const [, bot] = toParticipants(
    row({ players: [ME, "bot_1"], playerNames: ["me", "Charlie"] }),
    NO_USERS,
  );
  assert(bot.username === "Charlie", `Charlie attendu, reçu ${bot.username}`);
  assert(bot.isBot && !bot.deleted, "c'est un bot, pas un compte supprimé");
});

test("participants: compte supprimé → nom de l'époque, marqué supprimé", () => {
  const [p] = toParticipants(
    row({ players: ["gone"], playerNames: ["Ghost"] }),
    NO_USERS,
  );
  assert(p.username === "Ghost" && p.deleted, "Ghost, supprimé");
});

test("participants: ancienne partie sans noms enregistrés", () => {
  const [p, bot] = toParticipants(
    row({ players: ["gone", "bot_x"], playerNames: [] }),
    NO_USERS,
  );
  assert(
    p.username === "Deleted user",
    `Deleted user attendu, reçu ${p.username}`,
  );
  assert(bot.username === "Bot", `Bot attendu, reçu ${bot.username}`);
});

test("participants: changement d'ELO en ranked, null en classic", () => {
  const [me, other] = toParticipants(
    row({
      mode: "ranked",
      eloChanges: [
        { userId: ME, oldElo: 1000, newElo: 1012 },
        { userId: "other", oldElo: 1000, newElo: 988 },
      ],
    }),
    NO_USERS,
  );
  assert(me.oldElo === 1000 && me.newElo === 1012, "ELO de me");
  assert(other.newElo === 988, "ELO de other");
  const [c] = toParticipants(row(), NO_USERS);
  assert(c.oldElo === null && c.newElo === null, "null en classic");
});

test("participants: eloChanges abîmé → ignoré sans planter", () => {
  const [p] = toParticipants(
    row({ eloChanges: [{ userId: ME, oldElo: "x" }, null, 42] as unknown }),
    NO_USERS,
  );
  assert(p.newElo === null, "entrée invalide ignorée");
  const [q] = toParticipants(row({ eloChanges: "nope" as unknown }), NO_USERS);
  assert(q.newElo === null, "pas un tableau : ignoré");
});

test("participants: même ordre que players", () => {
  const m = match({ players: ["c", "a", "b"] });
  assert(m.participants.map((p) => p.id).join() === "c,a,b", "ordre conservé");
});

test("toMatch: winnerId vide → null, dates en ISO", () => {
  const m = match({ winnerId: "" });
  assert(m.winnerId === null, "null attendu");
  assert(m.endedAt === new Date(m.endedAt!).toISOString(), "date ISO");
});

test("humanIds: tous les comptes, sans bots ni doublons", () => {
  const ids = humanIds([
    row({ players: ["a", "bot_1"] }),
    row({ players: ["a", "b"] }),
  ]);
  assert(ids.sort().join() === "a,b", `a,b attendu, reçu ${ids.join()}`);
});

// ============================================================
// SUCCES
// ============================================================

test("succès: aucun pour un joueur sans partie", () => {
  const list = computeAchievements([], ME, 1000);
  assert(list.length === 14, `14 succès, reçu ${list.length}`);
  assert(
    list.every((a) => !a.unlocked && a.unlockedAt === null),
    "tous verrouillés",
  );
});

test("succès: First blood à la première victoire, avec sa date", () => {
  const first = win();
  const list = computeAchievements([loss(), first, win()], ME, 1000);
  const a = get(list, "first_win");
  assert(
    a.unlocked && a.unlockedAt === first.endedAt,
    "date de la 1re victoire",
  );
});

test("succès: 10 et 50 parties, avec la progression", () => {
  const ten = Array.from({ length: 10 }, () => loss());
  const list = computeAchievements(ten, ME, 1000);
  assert(get(list, "games_10").unlocked, "10 parties");
  assert(get(list, "games_10").unlockedAt === ten[9].endedAt, "date de la 10e");
  const fifty = get(list, "games_50");
  assert(
    !fifty.unlocked && fifty.progress === 10 && fifty.goal === 50,
    "10 / 50",
  );
});

test("succès: série de 5 victoires, cassée par une défaite", () => {
  const broken = [win(), win(), win(), win(), loss(), win()];
  let a = get(computeAchievements(broken, ME, 1000), "streak_5");
  assert(
    !a.unlocked && a.progress === 4,
    `meilleure série 4, reçu ${a.progress}`,
  );
  const five = [loss(), win(), win(), win(), win(), win()];
  a = get(computeAchievements(five, ME, 1000), "streak_5");
  assert(
    a.unlocked && a.unlockedAt === five[5].endedAt,
    "5e victoire de suite",
  );
});

test("succès: l'ordre de l'historique ne compte pas (récent d'abord)", () => {
  const list = [win(), win(), win(), win(), win()].reverse();
  assert(
    get(computeAchievements(list, ME, 1000), "streak_5").unlocked,
    "série vue",
  );
});

test("succès: gagner à 4 joueurs, pas à 3", () => {
  const three = win({ players: [ME, "a", "b"] });
  assert(
    !get(computeAchievements([three], ME, 1000), "full_table_win").unlocked,
    "3",
  );
  const four = win({ players: [ME, "a", "b", "c"] });
  assert(
    get(computeAchievements([four], ME, 1000), "full_table_win").unlocked,
    "4",
  );
  const lost4 = loss({ players: [ME, "a", "b", "c"] });
  assert(
    !get(computeAchievements([lost4], ME, 1000), "full_table_win").unlocked,
    "perdu",
  );
});

test("succès: victoire ranked, pas classic", () => {
  assert(
    !get(computeAchievements([win()], ME, 1000), "first_ranked_win").unlocked,
    "classic",
  );
  const ranked = win({ mode: "ranked" });
  assert(
    get(computeAchievements([ranked], ME, 1000), "first_ranked_win").unlocked,
    "ranked",
  );
});

test("succès: battre un bot", () => {
  const vsBot = win({ players: [ME, "bot_1"] });
  assert(
    get(computeAchievements([vsBot], ME, 1000), "beat_a_bot").unlocked,
    "bot battu",
  );
  const lostBot = loss({ players: [ME, "bot_1"], winnerId: "bot_1" });
  assert(
    !get(computeAchievements([lostBot], ME, 1000), "beat_a_bot").unlocked,
    "perdu",
  );
});

test("succès: 1200 ELO atteint en partie, gardé même si l'ELO redescend", () => {
  const up = match({
    mode: "ranked",
    winnerId: ME,
    eloChanges: [{ userId: ME, oldElo: 1190, newElo: 1205 }],
  });
  const down = match({
    mode: "ranked",
    eloChanges: [{ userId: ME, oldElo: 1205, newElo: 1180 }],
  });
  const a = get(computeAchievements([up, down], ME, 1180), "elo_1200");
  assert(
    a.unlocked && a.unlockedAt === up.endedAt,
    "débloqué à la partie qui l'a fait",
  );
  assert(a.progress === 1200, "progression bornée au but");
});

test("succès: 1200 ELO hors partie (seed) → débloqué sans date", () => {
  const a = get(computeAchievements([], ME, 1300), "elo_1200");
  assert(a.unlocked && a.unlockedAt === null, "débloqué sans date");
  const b = get(computeAchievements([], ME, 1100), "elo_1200");
  assert(!b.unlocked && b.progress === 1100, "1100 / 1200");
});

test("succès: les victoires d'un autre joueur ne comptent pas", () => {
  const list = computeAchievements([loss(), loss()], ME, 1000);
  assert(!get(list, "first_win").unlocked, "pas de victoire pour me");
});

// Partie d'une duree donnee (les parties par defaut durent 1 h)
const lasting = (minutes: number, over: Partial<MatchRow> = {}) => {
  const base = row(over);
  const endedAt = new Date(base.startedAt.getTime() + minutes * 60_000);
  return toMatch({ ...base, endedAt }, NO_USERS);
};

test("succès: Speedrunner, une victoire en moins de 5 minutes", () => {
  const fast = lasting(4, { winnerId: ME });
  assert(
    get(computeAchievements([fast], ME, 1000), "speed_win").unlocked,
    "4 min",
  );
  const slow = lasting(6, { winnerId: ME });
  assert(
    !get(computeAchievements([slow], ME, 1000), "speed_win").unlocked,
    "6 min",
  );
  const lostFast = lasting(3, { winnerId: "other" });
  assert(
    !get(computeAchievements([lostFast], ME, 1000), "speed_win").unlocked,
    "perdue",
  );
});

test("succès: Marathon, une partie de 15 minutes ou plus, gagnée ou non", () => {
  assert(
    get(computeAchievements([lasting(15)], ME, 1000), "marathon").unlocked,
    "15 min",
  );
  assert(
    !get(computeAchievements([lasting(14)], ME, 1000), "marathon").unlocked,
    "14 min",
  );
});

test("succès: Comeback, gagner juste après 3 défaites de suite", () => {
  const back = [loss(), loss(), loss(), win()];
  const a = get(computeAchievements(back, ME, 1000), "comeback");
  assert(
    a.unlocked && a.unlockedAt === back[3].endedAt,
    "la victoire après 3 défaites",
  );
  const two = [loss(), loss(), win()];
  assert(
    !get(computeAchievements(two, ME, 1000), "comeback").unlocked,
    "2 défaites seulement",
  );
  const broken = [loss(), loss(), win(), loss(), win()];
  assert(
    !get(computeAchievements(broken, ME, 1000), "comeback").unlocked,
    "série cassée",
  );
});

test("succès: Social butterfly, 10 adversaires différents, sans bots ni doublons", () => {
  const games = Array.from({ length: 9 }, (_, i) =>
    loss({ players: [ME, `p${i}`, "bot_x", "p0"] }),
  );
  let a = get(computeAchievements(games, ME, 1000), "social_10");
  assert(!a.unlocked && a.progress === 9, `9 adversaires, reçu ${a.progress}`);
  games.push(loss({ players: [ME, "p9"] }));
  a = get(computeAchievements(games, ME, 1000), "social_10");
  assert(a.unlocked && a.unlockedAt === games[9].endedAt, "le 10e débloque");
});

test("succès: Centurion à 100 parties", () => {
  const games = Array.from({ length: 100 }, () => loss());
  const a = get(computeAchievements(games, ME, 1000), "games_100");
  assert(a.unlocked && a.unlockedAt === games[99].endedAt, "la 100e");
  const b = get(computeAchievements(games.slice(0, 99), ME, 1000), "games_100");
  assert(!b.unlocked && b.progress === 99, "99 / 100");
});

test("succès: Legend à 1500 ELO, en partie ou hors partie", () => {
  const up = match({
    mode: "ranked",
    winnerId: ME,
    eloChanges: [{ userId: ME, oldElo: 1490, newElo: 1510 }],
  });
  assert(
    get(computeAchievements([up], ME, 1300), "elo_1500").unlockedAt ===
      up.endedAt,
    "en partie",
  );
  assert(
    get(computeAchievements([], ME, 1600), "elo_1500").unlocked,
    "hors partie",
  );
  const b = get(computeAchievements([], ME, 1232), "elo_1500");
  assert(!b.unlocked && b.progress === 1232, "1232 / 1500");
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
