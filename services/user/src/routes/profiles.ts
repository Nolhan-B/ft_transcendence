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

// Usernames: 3 to 20 letters (any language), digits, "_", "." or "-". No
// spaces, so a name can never be blank or look empty. Same rule in the
// frontend forms (USERNAME_PATTERN) and in the other service.
const USERNAME_PATTERN =
  "^[\\p{L}\\p{N}][\\p{L}\\p{N}_.\\-]{1,18}[\\p{L}\\p{N}]$";

// Signatures (magic bytes) of the accepted image formats
async function isImageOfType(filepath: string, ext: string): Promise<boolean> {
  const handle = await fs.promises.open(filepath, "r");
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    if (bytesRead < 12) return false;
    const isPng = head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isWebp =
      head.toString("ascii", 0, 4) === "RIFF" &&
      head.toString("ascii", 8, 12) === "WEBP";
    if (ext === ".png") return isPng;
    if (ext === ".jpg" || ext === ".jpeg") return isJpeg;
    if (ext === ".webp") return isWebp;
    return false;
  } finally {
    await handle.close();
  }
}

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
            username: {
              type: "string",
              minLength: 3,
              maxLength: 20,
              pattern: USERNAME_PATTERN,
            },
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

      // The extension proves nothing: an HTML or SVG file renamed .png was
      // accepted (security audit F-19). The first bytes must be a real PNG,
      // JPEG or WebP image, of the type the extension announces.
      if (!(await isImageOfType(filepath, ext))) {
        await fs.promises.unlink(filepath).catch(() => {});
        return reply.code(400).send({ error: "Invalid file type" });
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

  fastify.get("/users/by-username/:username", async (request, reply) => {
    await request.jwtVerify();
    const { username } = request.params as { username: string };

    const profile = await profileService.getProfileByUsername(
      fastify.prisma,
      username,
    );
    if (!profile) return reply.code(404).send({ error: "User not found" });

    return reply.send(profile);
  });
}
