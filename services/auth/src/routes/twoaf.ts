import { FastifyInstance } from "fastify";
import * as twofaService from "../services/twoaf.service.js";
import {
  consumeChallenge,
  isReplayedCode,
  readChallenge,
  recordFailedCode,
} from "../services/challenge.service.js";
import type {
  TwoFactorVerifyPayload,
  TwoFactorValidatePayload,
  TwoFactorDisablePayload,
  JwtPayload,
} from "shared";
import { openSession, revokeSessions } from "../services/session.service.js";

export default async function twofaRoutes(fastify: FastifyInstance) {
  fastify.post("/2fa/enable", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    try {
      const qrCode = await twofaService.enableTwoFactor(fastify.prisma, id);
      if (!qrCode) return reply.code(404).send({ error: "User not found" });
      return reply.send({ qrCode });
    } catch (err: unknown) {
      const prismaError = err as { code?: string };
      // Handle case where JWT is valid but user record no longer exists
      if (prismaError.code === "P2025") {
        return reply.code(404).send({ error: "User not found" });
      }

      if (prismaError.code === "2FA_ALREADY_ENABLED") {
        return reply.code(409).send({ error: "2FA is already enabled" });
      }
      request.log.error(err);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });

  fastify.post(
    "/2fa/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();
      const { id } = request.user as JwtPayload;
      const { code } = request.body as TwoFactorVerifyPayload;

      try {
        const user = await twofaService.verifyTwoFactor(
          fastify.prisma,
          id,
          code,
        );
        if (!user) return reply.code(401).send({ error: "Invalid code" });

        // 2FA on: sessions opened without it are revoked, this browser keeps
        // a fresh one (audit F-07)
        await revokeSessions(fastify, id);
        await openSession(fastify, reply, id);
        return reply.send({ message: "2FA enabled", user });
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

  fastify.post(
    "/2fa/validate",
    {
      schema: {
        body: {
          type: "object",
          required: ["tempToken", "code"],
          properties: {
            tempToken: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 6, maxLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const { tempToken, code } = request.body as TwoFactorValidatePayload;

      // Jeton de l'etape 2FA seulement : une session ou un jeton deja
      // utilise sont refuses (audit F-03)
      const userId = readChallenge(fastify, tempToken);
      if (!userId) {
        return reply
          .code(401)
          .send({ error: "Invalid or expired temporary token" });
      }
      // Code deja utilise pour ouvrir une session : pas de rejeu (audit F-24)
      if (isReplayedCode(userId, code)) {
        return reply.code(401).send({ error: "Invalid code" });
      }

      try {
        const user = await twofaService.validateTwoFactor(
          fastify.prisma,
          userId,
          code,
        );
        if (!user) {
          recordFailedCode(fastify, tempToken);
          return reply.code(401).send({ error: "Invalid code" });
        }
        consumeChallenge(fastify, tempToken, userId, code);

        await openSession(fastify, reply, user.id);

        // Session in the HttpOnly cookie only, never in the body (audit F-08)
        return reply.send({ user });
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

  fastify.post(
    "/2fa/disable",
    {
      schema: {
        body: {
          type: "object",
          required: ["password", "code"],
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
      const { password, code } = request.body as TwoFactorDisablePayload;

      try {
        const user = await twofaService.disableTwoFactor(
          fastify.prisma,
          id,
          password,
          code,
        );
        if (!user) {
          return reply
            .code(401)
            .send({ error: "Invalid password or TOTP code" });
        }

        // 2FA off: every other session is revoked (audit F-07)
        await revokeSessions(fastify, id);
        await openSession(fastify, reply, id);
        return reply.send({ message: "2FA disabled", user });
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
}
