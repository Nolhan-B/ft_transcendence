import { FastifyInstance } from "fastify";
import * as authService from "../services/auth.service.js";
import type {
  SignupPayload,
  LoginPayload,
  TwoFactorRequiredResponse,
  JwtPayload,
} from "shared";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60,
};

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
            username: { type: "string", minLength: 3, maxLength: 20 },
            password: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, username, password } = request.body as SignupPayload;

      try {
        const user = await authService.signup(
          fastify.prisma,
          email,
          username,
          password,
        );
        const token = fastify.jwt.sign(
          { id: user.id, email: user.email },
          { expiresIn: "7d" },
        );

        reply.setCookie("access_token", token, COOKIE_OPTIONS);

        return reply.code(201).send({ token, user });
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
        const tempToken = fastify.jwt.sign(
          { id: user.id, requires2FA: true },
          { expiresIn: "10m" },
        );
        return reply.send({
          requiresTwoFactor: true,
          tempToken,
        } as TwoFactorRequiredResponse);
      }

      const token = fastify.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: "7d" },
      );

      reply.setCookie("access_token", token, COOKIE_OPTIONS);

      return reply.send({ token, user });
    },
  );

  fastify.post("/logout", async (_request, reply) => {
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

  fastify.delete("/account", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;
    const { password, code } = request.body as {
      password: string;
      code?: string;
    };

    const deleted = await authService.deleteAccount(
      fastify.prisma,
      id,
      password,
      code,
    );
    if (!deleted)
      return reply.code(401).send({ error: "Invalid password or 2FA code" });

    reply.clearCookie("access_token", { path: "/" });
    return reply.send({ message: "Account deleted" });
  });
}
