import Fastify, { FastifyError } from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import profileRoutes from "./routes/profiles.js";
import friendsRoutes from "./routes/friends.js";
import fs from "node:fs";
import process from "node:process";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import path from "path";
import { setupMetrics } from "shared";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

if (fs.existsSync("/run/secrets/jwt_secret")) {
  process.env.JWT_SECRET = fs
    .readFileSync("/run/secrets/jwt_secret", "utf-8")
    .trim();
}

const fastify = Fastify({ logger: true });

// Global error handler to map Prisma/Fastify errors cleanly and prevent stack trace leaks
fastify.setErrorHandler(
  (error: FastifyError & { code?: string }, request, reply) => {
    // Handle Prisma unique constraint violations
    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Resource already exists" });
    }
    // Handle Prisma record not found on update/delete
    if (error.code === "P2025") {
      return reply.code(404).send({ error: "Resource not found" });
    }
    // Handle Prisma foreign key constraint violations
    if (error.code === "P2003") {
      return reply
        .code(409)
        .send({ error: "Cannot complete operation due to related records" });
    }
    // Handle Prisma serializable transaction write conflicts (concurrent race conditions)
    if (error.code === "P2034") {
      return reply
        .code(409)
        .send({ error: "Concurrent modification conflict, please retry" });
    }

    // Preserve standard 4xx client errors (Ajv validation, JWT auth, multipart 413, malformed JSON)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        error: error.name,
        message: error.message,
      });
    }

    // Log unexpected 500 errors internally without exposing details to the client
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  },
);

setupMetrics(fastify, "user-service");

// Ensure uploads directory exists before registering @fastify/static
const uploadsRoot = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsRoot, { recursive: true });

fastify.register(staticPlugin, {
  root: uploadsRoot,
  prefix: "/uploads/",
});

fastify.register(prismaPlugin);
fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max
fastify.register(cookie);
fastify.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret",
  cookie: {
    cookieName: "access_token",
    signed: false,
  },
});

fastify.register(profileRoutes);
fastify.register(friendsRoutes);

fastify.route({
  method: ["GET", "HEAD"],
  url: "/health",
  logLevel: "silent",
  handler: async () => ({ service: "user", status: "ok" }),
});

fastify.get("/", async () => {
  return { service: "user", status: "ok" };
});

const start = async () => {
  try {
    const port = Number(process.env.USER_PORT ?? 3004);
    await fastify.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
