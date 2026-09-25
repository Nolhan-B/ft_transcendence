import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client.js';
import type { User } from 'shared';

export async function signup(
  prisma: PrismaClient,
  email: string,
  username: string,
  password: string,
): Promise<Omit<User, 'twoFactorSecret' | 'twoFactorSecretEnabled'>> {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, username, password: hashedPassword },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function login(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<Omit<User, 'twoFactorSecret'> | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    twoFactorSecretEnabled: user.twoFactorSecretEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getMe(
  prisma: PrismaClient,
  id: string,
): Promise<Omit<User, 'twoFactorSecret'> | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    twoFactorSecretEnabled: user.twoFactorSecretEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}
