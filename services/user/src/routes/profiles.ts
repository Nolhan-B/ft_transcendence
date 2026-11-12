import { FastifyInstance } from "fastify";
import * as profileService from "../services/profile.service.js";
import type { JwtPayload, UpdateProfilePayload } from "shared";
import { pipeline } from "stream/promises";
import fs from "fs";
import path from "path";

// Reusable JSON schema to validate UUID route parameters before hitting Prisma
const uuidParamSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
};

export default async function profileRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/profile/:id",
    { schema: uuidParamSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const profile = await profileService.getProfileById(fastify.prisma, id);
      if (!profile) return reply.code(404).send({ error: "User not found" });
      return reply.send({ profile });
    },
  );

  fastify.get("/profile", async (request, reply) => {
    await request.jwtVerify();

    const { id } = request.user as JwtPayload;

    const profile = await profileService.getProfileById(fastify.prisma, id);
    if (!profile) return reply.code(404).send({ error: "User not found" });

    return reply.send({ profile });
  });

  fastify.put(
    "/profile",
    {
      schema: {
        body: {
          type: "object",
          minProperties: 1,
          additionalProperties: false,
          properties: {
            username: { type: "string", minLength: 3, maxLength: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      await request.jwtVerify();

      const data = request.body as UpdateProfilePayload;
      const { id } = request.user as JwtPayload;

      try {
        const updatedProfile = await profileService.updateProfile(
          fastify.prisma,
          id,
          data,
        );
        if (!updatedProfile)
          return reply.code(404).send({ error: "User not found" });

        return reply.send({ updatedProfile });
      } catch (err: unknown) {
        const prismaError = err as { code?: string };
        // Handle unique constraint violation when username is already taken
        if (prismaError.code === "P2002") {
          return reply.code(409).send({ error: "Username already taken" });
        }
        // Handle deleted user account with still-valid JWT
        if (prismaError.code === "P2025") {
          return reply.code(404).send({ error: "User not found" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
      }
    },
  );

  fastify.put("/profile/avatar", async (request, reply) => {
    await request.jwtVerify();
    const { id } = request.user as JwtPayload;

    // Reject non-multipart requests cleanly instead of throwing an unhandled error
    if (!request.isMultipart()) {
      return reply
        .code(400)
        .send({ error: "Request must be multipart/form-data" });
    }

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "No file uploaded" });

    const ext = path.extname(file.filename).toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    if (!allowed.includes(ext)) {
      // Drain stream so Fastify does not hang on unread multipart data
      file.file.resume();
      return reply.code(400).send({ error: "Invalid file type" });
    }

    const uploadDir = path.join(process.cwd(), "uploads", "avatars");
    const filename = `${id}-${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    try {
      // Ensure upload directory exists to prevent ENOENT 500 errors
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const currentUser = await fastify.prisma.user.findUnique({
        where: { id },
      });
      if (!currentUser) {
        file.file.resume();
        return reply.code(404).send({ error: "User not found" });
      }

      await pipeline(file.file, fs.createWriteStream(filepath));

      // Check if file exceeded multipart size limit during streaming
      if (file.file.truncated) {
        await fs.promises.unlink(filepath).catch(() => {});
        return reply.code(413).send({ error: "File too large" });
      }

      const profile = await profileService.updateAvatar(
        fastify.prisma,
        id,
        `/uploads/avatars/${filename}`,
      );
      if (!profile) {
        await fs.promises.unlink(filepath).catch(() => {});
        return reply.code(404).send({ error: "User not found" });
      }

      // Delete previous avatar only after the new upload and DB update succeed
      if (currentUser.avatarUrl) {
        const oldPath = path.join(process.cwd(), currentUser.avatarUrl);
        fs.unlink(oldPath, () => {});
      }

      return reply.send({ profile });
    } catch (err: unknown) {
      // Clean up partially written file on any failure
      await fs.promises.unlink(filepath).catch(() => {});

      const prismaError = err as { code?: string };
      if (prismaError.code === "P2025") {
        return reply.code(404).send({ error: "User not found" });
      }
      request.log.error(err);
      return reply.code(500).send({ error: "Internal server error" });
    }
  });
}
