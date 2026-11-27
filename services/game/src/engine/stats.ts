import type {
  Achievement,
  AchievementId,
  GameMode,
  Match,
  MatchParticipant,
} from "shared";

// Une partie telle qu'elle est enregistree (table Match)
export interface MatchRow {
  id: string;
  mode: string;
  players: string[];
  playerNames: string[];
  ranking: string[];
  winnerId: string;
  eloChanges: unknown;
  startedAt: Date;
  endedAt: Date;
}

// Un compte qui existe encore
export interface UserInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
}

interface EloChange {
  userId: string;
  oldElo: number;
  newElo: number;
}

const isBotId = (id: string) => id.startsWith("bot_");

function readEloChanges(value: unknown): EloChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is EloChange =>
      typeof c?.userId === "string" &&
      typeof c?.oldElo === "number" &&
      typeof c?.newElo === "number",
  );
}

// Les joueurs d'une partie, avec leur pseudo actuel (ou celui de l'epoque pour
// un bot ou un compte supprime) et leur changement d'ELO
export function toParticipants(
  row: MatchRow,
  users: Map<string, UserInfo>,
): MatchParticipant[] {
  const changes = readEloChanges(row.eloChanges);
  return row.players.map((id, index) => {
    const user = users.get(id);
    const bot = isBotId(id);
    const change = changes.find((c) => c.userId === id);
    return {
      id,
      username:
        user?.username ??
        row.playerNames[index] ??
        (bot ? "Bot" : "Deleted user"),
      avatarUrl: user?.avatarUrl ?? null,
      isBot: bot,
      deleted: !bot && !user,
      oldElo: change?.oldElo ?? null,
      newElo: change?.newElo ?? null,
    };
  });
}

export function toMatch(row: MatchRow, users: Map<string, UserInfo>): Match {
  return {
    id: row.id,
    mode: row.mode as GameMode,
    players: row.players,
    participants: toParticipants(row, users),
    ranking: row.ranking,
    winnerId: row.winnerId || null,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
  };
}

// Les comptes a chercher en base pour un lot de parties (pas les bots)
export function humanIds(rows: MatchRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows)
    for (const id of row.players) if (!isBotId(id)) ids.add(id);
  return [...ids];
}

const DEFINITIONS: {
  id: AchievementId;
  title: string;
  description: string;
  goal: number;
}[] = [
  { id: "first_win", title: "First blood", description: "Win a game", goal: 1 },
  { id: "games_10", title: "Regular", description: "Play 10 games", goal: 10 },
  { id: "games_50", title: "Veteran", description: "Play 50 games", goal: 50 },
  {
    id: "streak_5",
    title: "On fire",
    description: "Win 5 games in a row",
    goal: 5,
  },
  {
    id: "full_table_win",
    title: "King of the table",
    description: "Win a game with 4 players",
    goal: 1,
  },
  {
    id: "first_ranked_win",
    title: "Contender",
    description: "Win a ranked game",
    goal: 1,
  },
  {
    id: "elo_1200",
    title: "Rising star",
    description: "Reach 1200 ELO",
    goal: 1200,
  },
  {
    id: "beat_a_bot",
    title: "Machine breaker",
    description: "Win a game against a bot",
    goal: 1,
  },
];

// Les succes d'un joueur, calcules a partir de son historique (dans n'importe
// quel ordre) et de son ELO actuel. Chaque succes garde la date de la partie
// qui l'a debloque.
export function computeAchievements(
  matches: Match[],
  userId: string,
  currentElo: number,
): Achievement[] {
  const chronological = [...matches].sort(
    (a, b) =>
      Date.parse(a.endedAt ?? a.startedAt) -
      Date.parse(b.endedAt ?? b.startedAt),
  );

  const progress = new Map<AchievementId, number>();
  const unlockedAt = new Map<AchievementId, string | null>();
  const goalOf = (id: AchievementId) =>
    DEFINITIONS.find((d) => d.id === id)!.goal;

  // Monte la progression ; au premier passage du but, retient la date
  const advance = (id: AchievementId, value: number, at: string | null) => {
    const best = Math.max(progress.get(id) ?? 0, value);
    progress.set(id, best);
    if (best >= goalOf(id) && !unlockedAt.has(id)) unlockedAt.set(id, at);
  };

  let played = 0;
  let streak = 0;
  for (const match of chronological) {
    const at = match.endedAt ?? match.startedAt;
    const won = match.winnerId === userId;
    played++;
    streak = won ? streak + 1 : 0;

    advance("games_10", played, at);
    advance("games_50", played, at);
    advance("streak_5", streak, at);
    if (won) {
      advance("first_win", 1, at);
      if (match.players.length >= 4) advance("full_table_win", 1, at);
      if (match.mode === "ranked") advance("first_ranked_win", 1, at);
      if (match.players.some(isBotId)) advance("beat_a_bot", 1, at);
    }
    const me = match.participants.find((p) => p.id === userId);
    if (me?.newElo != null) advance("elo_1200", me.newElo, at);
  }
  // ELO actuel (un ELO donne hors partie, par exemple par le seed) : debloque
  // sans date de partie
  advance("elo_1200", currentElo, null);

  return DEFINITIONS.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    unlocked: unlockedAt.has(d.id),
    unlockedAt: unlockedAt.get(d.id) ?? null,
    progress: Math.min(progress.get(d.id) ?? 0, d.goal),
    goal: d.goal,
  }));
}
