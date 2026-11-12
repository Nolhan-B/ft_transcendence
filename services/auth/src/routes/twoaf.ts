import { FastifyInstance } from "fastify";
import * as twofaService from "../services/twoaf.service.js";
import type {
  TwoFactorVerifyPayload,
  TwoFactorValidatePayload,
  TwoFactorDisablePayload,
  TempTokenPayload,
  JwtPayload,
} from "shared";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60,
};

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

      // Catch expired or malformed temporary tokens cleanly as 401 instead of 500
      let payload: TempTokenPayload;
      try {
        payload = fastify.jwt.verify<TempTokenPayload>(tempToken);
      } catch {
        return reply
          .code(401)
          .send({ error: "Invalid or expired temporary token" });
      }

      if (!payload.requires2FA) {
        return reply.code(401).send({ error: "Invalid token" });
      }

      try {
        const user = await twofaService.validateTwoFactor(
          fastify.prisma,
          payload.id,
          code,
        );
        if (!user) return reply.code(401).send({ error: "Invalid code" });

        const token = fastify.jwt.sign(
          { id: user.id, email: user.email },
          { expiresIn: "7d" },
        );

        reply.setCookie("access_token", token, COOKIE_OPTIONS);

        return reply.send({ token, user });
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
