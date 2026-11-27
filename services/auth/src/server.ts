import "dotenv/config";
import Fastify, { FastifyError } from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import prismaPlugin from "./plugins/prisma.js";
import authRoutes from "./routes/auth.js";
import twofaRoutes from "./routes/twoaf.js";
import fs from "node:fs";
import process from "node:process";
import {
  isSessionCurrent,
  jwtSecretOrExit,
  setupMetrics,
  setupOriginCheck,
} from "shared";
import type { SessionPayload } from "shared";
import { initChallengeKey } from "./services/challenge.service.js";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

// Without a key in production the service refuses to start, instead of
// signing with a key everybody knows
const jwtSecret = jwtSecretOrExit(
  fs.existsSync("/run/secrets/jwt_secret")
    ? fs.readFileSync("/run/secrets/jwt_secret", "utf-8")
    : process.env.JWT_SECRET,
);
// Cle distincte pour le jeton de l'etape 2FA (audit F-03)
initChallengeKey(jwtSecret);

const app = Fastify({ logger: true });

// Global error handler to map Prisma/Fastify errors cleanly and prevent stack trace leaks
app.setErrorHandler(
  (error: FastifyError & { code?: string }, request, reply) => {
    // Handle Prisma known request errors globally as a safety net
    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Resource already exists" });
    }
    if (error.code === "P2025") {
      return reply.code(404).send({ error: "Resource not found" });
    }
    if (error.code === "P2003") {
      return reply
        .code(409)
        .send({ error: "Cannot complete operation due to related records" });
    }

    // Preserve standard 4xx client errors (Ajv validation, JWT auth, malformed JSON)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        error: error.name,
        message: error.message,
      });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  },
);

setupMetrics(app, "auth-service");
// Writes sent from another website are refused (security audit F-25)
setupOriginCheck(app);

async function start() {
  try {
    await app.register(cookie);
    await app.register(jwt, {
      secret: jwtSecret,
      cookie: {
        cookieName: "access_token",
        signed: false,
      },
      // Revoked sessions are refused (security audit F-07)
      trusted: (_request, decoded) =>
        isSessionCurrent(app.prisma, decoded as SessionPayload),
    });

    await app.register(prismaPlugin);
    await app.register(authRoutes);
    await app.register(twofaRoutes);

    const port = Number(process.env.AUTH_PORT ?? 3001);
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
