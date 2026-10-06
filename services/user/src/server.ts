import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import jwt from "@fastify/jwt";
import profileRoutes from "./routes/profiles.js";
import fs from "node:fs";
import process from "node:process";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import path from "path";

if (fs.existsSync("/run/secrets/db_url")) {
  process.env.DATABASE_URL = fs
    .readFileSync("/run/secrets/db_url", "utf-8")
    .trim();
}
const fastify = Fastify({ logger: true });

fastify.register(staticPlugin, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
});

fastify.register(prismaPlugin);
fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max
fastify.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret" });
fastify.register(profileRoutes);

fastify.get("/health", async () => ({ service: "user", status: "ok" }));

const port = Number(process.env.USER_PORT ?? 3004);
fastify.listen({ port, host: "0.0.0.0" }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});

fastify.get("/", async () => {
  return { service: "user", status: "ok" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3004, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
