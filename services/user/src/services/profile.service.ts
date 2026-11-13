import { PrismaClient } from "shared";
import type { Profile, UpdateProfilePayload } from "shared";

// Shared projection to avoid loading sensitive fields (password, 2FA secret) into memory
const PROFILE_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
  elo: true,
} as const;

export async function getProfileById(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    elo: user.elo,
  };
}

export async function updateProfile(
  prisma: PrismaClient,
  id: string,
  data: UpdateProfilePayload,
): Promise<Profile | null> {
  if (!id || !data) return null;

  // Explicitly whitelist allowed fields matching UpdateProfilePayload
  const updateData: { username?: string } = {};
  if (data.username !== undefined) updateData.username = data.username;

  if (Object.keys(updateData).length === 0) {
    return getProfileById(prisma, id);
  }

  // Single atomic UPDATE query; P2002 and P2025 are handled by the route / global error handler
  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: PROFILE_SELECT,
  });

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatarUrl,
    createdAt: updatedUser.createdAt.toISOString(),
    elo: updatedUser.elo,
  };
}

export async function updateAvatar(
  prisma: PrismaClient,
  id: string,
  avatarUrl: string,
): Promise<Profile | null> {
  if (!id || !avatarUrl) return null;

  // Single atomic UPDATE query; P2025 is handled by the route / global error handler
  const updatedUser = await prisma.user.update({
    where: { id },
    data: { avatarUrl },
    select: PROFILE_SELECT,
  });

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatarUrl,
    createdAt: updatedUser.createdAt.toISOString(),
    elo: updatedUser.elo,
  };
}
