import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

// Jeton de l'etape 2FA (login avec 2FA active -> /2fa/validate).
//
// Audit F-03 : il etait signe avec la cle des sessions, donc tous les
// services l'acceptaient comme une session, sans code TOTP. Il est
// maintenant signe avec une cle derivee que seul ce service connait : partout
// ailleurs la signature est fausse (401). Il ne sert qu'une fois, et un code
// TOTP deja utilise ne peut pas etre rejoue dans sa fenetre (audit F-24).

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
// Un code TOTP est valable 30 s, avec une tolerance d'une fenetre
const TOTP_REPLAY_MS = 90 * 1000;
// Codes faux acceptes par jeton avant qu'il soit grille (audit F-06)
const MAX_FAILED_CODES = 5;

let challengeKey = "";

// Appele au demarrage avec le secret des sessions
export function initChallengeKey(jwtSecret: string): void {
  challengeKey = createHmac("sha256", jwtSecret)
    .update("2fa-challenge")
    .digest("hex");
}

interface ChallengePayload {
  id: string;
  jti: string;
  scope: "2fa";
}

// Jetons deja consommes, et dernier code TOTP accepte par utilisateur
const usedChallenges = new Map<string, number>();
const lastCodes = new Map<string, { code: string; at: number }>();
const failedCodes = new Map<string, { count: number; expires: number }>();

function cleanup(now: number): void {
  for (const [jti, expires] of usedChallenges)
    if (expires <= now) usedChallenges.delete(jti);
  for (const [jti, failed] of failedCodes)
    if (failed.expires <= now) failedCodes.delete(jti);
  for (const [id, last] of lastCodes)
    if (now - last.at > TOTP_REPLAY_MS) lastCodes.delete(id);
}

export function signChallenge(
  fastify: FastifyInstance,
  userId: string,
): string {
  return fastify.jwt.sign(
    { id: userId, jti: randomUUID(), scope: "2fa" },
    { key: challengeKey, expiresIn: "10m" },
  );
}

// L'id de l'utilisateur si le jeton est valide et pas encore utilise
export function readChallenge(
  fastify: FastifyInstance,
  token: string,
): string | null {
  try {
    const payload = fastify.jwt.verify<ChallengePayload>(token, {
      key: challengeKey,
    });
    if (payload.scope !== "2fa" || !payload.jti) return null;
    if (usedChallenges.has(payload.jti)) return null;
    return payload.id;
  } catch {
    return null;
  }
}

// Apres une validation reussie : le jeton et le code ne servent plus
export function consumeChallenge(
  fastify: FastifyInstance,
  token: string,
  userId: string,
  code: string,
): void {
  const now = Date.now();
  cleanup(now);
  const { jti } = fastify.jwt.decode<ChallengePayload>(token) ?? {};
  if (jti) usedChallenges.set(jti, now + CHALLENGE_TTL_MS);
  lastCodes.set(userId, { code, at: now });
}

// Code faux : au bout de MAX_FAILED_CODES, le jeton ne sert plus (il faut
// se reconnecter avec le mot de passe)
export function recordFailedCode(
  fastify: FastifyInstance,
  token: string,
): void {
  const now = Date.now();
  cleanup(now);
  const { jti } = fastify.jwt.decode<ChallengePayload>(token) ?? {};
  if (!jti) return;
  const count = (failedCodes.get(jti)?.count ?? 0) + 1;
  failedCodes.set(jti, { count, expires: now + CHALLENGE_TTL_MS });
  if (count >= MAX_FAILED_CODES)
    usedChallenges.set(jti, now + CHALLENGE_TTL_MS);
}

// Ce code vient deja d'ouvrir une session pour cet utilisateur
export function isReplayedCode(userId: string, code: string): boolean {
  const last = lastCodes.get(userId);
  return !!last && last.code === code && Date.now() - last.at <= TOTP_REPLAY_MS;
}
