import { PrismaClient } from '../generated/prisma/client.js';
import type { Profile, UpdateProfilePayload } from 'shared';

export async function getProfileById(
  prisma: PrismaClient,
  userId: string,
): Promise<Profile | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

// Route qui sera amener a evoluer (vocation: update plusieurs champs at once)
export async function updateProfile(
  prisma: PrismaClient,
  id: string,
  data: UpdateProfilePayload,
): Promise<Profile | null> {
  if (!data) return null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  const updatedUser = await prisma.user.update({ where: { id }, data });

  if (!updatedUser) return null;

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatarUrl,
    createdAt: updatedUser.createdAt.toISOString(),
  };
}

export async function updateAvatar(
  prisma: PrismaClient,
  id: string,
  avatarUrl: string,
): Promise<Profile | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { avatarUrl },
  });

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatarUrl,
    createdAt: updatedUser.createdAt.toISOString(),
  };
}
