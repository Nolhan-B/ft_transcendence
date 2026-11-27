import { FastifyInstance } from "fastify";
import * as authService from "../services/auth.service.js";
import type {
  SignupPayload,
  LoginPayload,
  TwoFactorRequiredResponse,
  JwtPayload,
} from "shared";
import { signChallenge } from "../services/challenge.service.js";
import { openSession, revokeSessions } from "../services/session.service.js";

// Usernames: 3 to 20 letters (any language), digits, "_", "." or "-". No
// spaces, so a name can never be blank or look empty. Same rule in the
// frontend forms (USERNAME_PATTERN) and in the other service.
const USERNAME_PATTERN =
  "^[\\p{L}\\p{N}][\\p{L}\\p{N}_.\\-]{1,18}[\\p{L}\\p{N}]$";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/signup",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "username", "password"],
          properties: {
            email: { type: "string", format: "email" },
            username: {
              type: "string",
              minLength: 3,
              maxLength: 20,
              pattern: USERNAME_PATTERN,
            },
            // 72 at most: bcrypt ignores what comes after (audit F-16)
            password: { type: "string", minLength: 8, maxLength: 72 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, username, password } = request.body as SignupPayload;

      try {
        // Same email or username in another case: already taken (audit F-17)
        if (
          (await authService.isEmailTaken(fastify.prisma, email)) ||
          (await authService.isUsernameTaken(fastify.prisma, username))
        ) {
          return reply
            .code(409)
            .send({ error: "Email or username already taken" });
        }
        const user = await authService.signup(
          fastify.prisma,
          email,
          username,
          password,
        );
        await openSession(fastify, reply, user.id);

        // Session in the HttpOnly cookie only, never in the body (audit F-08)
        return reply.code(201).send({ user });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2002") {
          return reply
            .code(409)
            .send({ error: "Email or username already taken" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as LoginPayload;

      const user = await authService.login(fastify.prisma, email, password);
      if (!user) return reply.code(401).send({ error: "Invalid credentials" });

      if (user.twoFactorSecretEnabled) {
        // Jeton de l'etape 2FA : refuse partout ailleurs (audit F-03)
        const tempToken = signChallenge(fastify, user.id);
        return reply.send({
          requiresTwoFactor: true,
          tempToken,
        } as TwoFactorRequiredResponse);
      }

      await openSession(fastify, reply, user.id);

      // Session in the HttpOnly cookie only, never in the body (audit F-08)
      return reply.send({ user });
    },
  );

  fastify.post("/logout", async (request, reply) => {
    // Logout revokes the session for real, on every device (audit F-07):
    // a copied token stops working too. No valid session: nothing to revoke
    try {
      const { id } = (await request.jwtVerify()) as JwtPayload;
      await revokeSessions(fastify, id);
    } catch {
      // Already logged out, expired or revoked
    }
    reply.clearCookie("access_token", { path: "/" });
    return reply.send({ message: "Logged out" });
  });

  fastify.get("/health", { logLevel: "silent" }, async () => ({
    service: "auth",
    status: "ok",
  }));

  fastify.get("/me", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    const user = await authService.getMe(fastify.prisma, id);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return { user };
  });

  // Who is connected, for the website: always 200, { user: null } for a
  // visitor or a revoked session. GET /me answers 401 in that case, and the
  // browser logs every 401 as an error in the console, on every page.
  fastify.get("/session", async (request) => {
    try {
      await request.jwtVerify();
    } catch {
      return { user: null };
    }
    const { id } = request.user as JwtPayload;
    const user = await authService.getMe(fastify.prisma, id);
    return { user: user ?? null };
  });

  fastify.post(
    "/password",
    {
      schema: {
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 8, maxLength: 72 },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      const { id } = request.user as JwtPayload;
      const { currentPassword, newPassword, code } = request.body as {
        currentPassword: string;
        newPassword: string;
        code?: string;
      };

      try {
        const result = await authService.changePassword(
          fastify.prisma,
          id,
          currentPassword,
          newPassword,
          code,
        );

        if (result === "INVALID_CREDENTIALS") {
          return reply
            .code(401)
            .send({ error: "Invalid current password or 2FA code" });
        }

        if (result === "SAME_PASSWORD") {
          return reply.code(400).send({
            error: "New password must be different from current password",
          });
        }

        // New password: every other session is revoked, this browser keeps
        // a fresh one (audit F-07)
        await revokeSessions(fastify, id);
        await openSession(fastify, reply, id);
        return reply.send({ message: "Password updated successfully" });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2025") {
          return reply.code(404).send({ error: "User not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.delete(
    "/account",
    {
      schema: {
        body: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      const { id } = request.user as JwtPayload;
      const { password, code } = request.body as {
        password: string;
        code?: string;
      };

      try {
        const deleted = await authService.deleteAccount(
          fastify.prisma,
          id,
          password,
          code,
        );
        if (!deleted) {
          return reply
            .code(401)
            .send({ error: "Invalid password or 2FA code" });
        }

        reply.clearCookie("access_token", { path: "/" });
        return reply.send({ message: "Account deleted" });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2025") {
          reply.clearCookie("access_token", { path: "/" });
          return reply.code(404).send({ error: "Account already deleted" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );
}
