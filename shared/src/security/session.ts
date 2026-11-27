// Session revocation (security audit F-07).
//
// Every session JWT carries `v`, a copy of the user's tokenVersion at login.
// The version is bumped on logout, password change and 2FA change: from then
// on, every older token is refused by every service, even if it is not
// expired yet. A token without `v` (issued before this check) counts as 0.

// Only what the check needs from a Prisma client, so that any service (and
// the test mocks) can pass its own
interface UserReader {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { tokenVersion: true };
    }): Promise<{ tokenVersion?: number | null } | null>;
  };
}

export interface SessionPayload {
  id: string;
  v?: number;
}

// True if the token belongs to an existing user and was issued since the
// last revocation
export async function isSessionCurrent(
  prisma: UserReader,
  payload: SessionPayload,
): Promise<boolean> {
  if (!payload || typeof payload.id !== "string") return false;
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { tokenVersion: true },
  });
  if (!user) return false;
  return (user.tokenVersion ?? 0) === (payload.v ?? 0);
}

// The JWT key of a service. Missing in production: the service stops at once
// rather than signing with a key everybody knows. Outside production (local
// runs, tests) a fixed development key is used, with a warning.
export function jwtSecretOrExit(secret: string | undefined): string {
  if (secret && secret.trim() !== "") return secret.trim();
  if (process.env.NODE_ENV === "production") {
    console.error(
      "FATAL: no JWT secret (secrets/jwt_secret.txt). Refusing to start.",
    );
    process.exit(1);
  }
  console.warn("WARNING: no JWT secret, using the development key");
  return "dev-secret";
}
