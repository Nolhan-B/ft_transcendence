import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import prismaPlugin from "./plugins/prisma.js";
import authRoutes from "./routes/auth.js";
import twofaRoutes from "./routes/twoaf.js";
import fs from "node:fs";
import process from "node:process";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}

let jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
if (fs.existsSync("/run/secrets/jwt_secret")) {
  jwtSecret = fs.readFileSync("/run/secrets/jwt_secret", "utf-8").trim();
}

const app = Fastify({ logger: true });

async function start() {
  try {
    await app.register(cookie);
    await app.register(jwt, {
      secret: jwtSecret,
      cookie: {
        cookieName: "access_token",
        signed: false,
      },
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
