import type { FastifyInstance, FastifyReply } from "fastify";

// Sessions: a JWT in an HttpOnly cookie, carrying the user's tokenVersion
// (`v`). Bumping the version revokes every session issued before (security
// audit F-07): each service checks it (isSessionCurrent in shared).

const SESSION_TTL = "7d";

export const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60,
};

// Opens a session for this user on this browser: sets the cookie
export async function openSession(
  fastify: FastifyInstance,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const user = await fastify.prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const token = fastify.jwt.sign(
    { id: userId, v: user?.tokenVersion ?? 0 },
    { expiresIn: SESSION_TTL },
  );
  reply.setCookie("access_token", token, COOKIE_OPTIONS);
}

// Every session of this user stops working, on every device
export async function revokeSessions(
  fastify: FastifyInstance,
  userId: string,
): Promise<void> {
  await fastify.prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
