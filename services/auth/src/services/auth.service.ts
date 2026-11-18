import bcrypt from "bcrypt";
import { PrismaClient } from "shared";
import type { User } from "shared";
import { authenticator } from "@otplib/preset-default";

export async function signup(
  prisma: PrismaClient,
  email: string,
  username: string,
  password: string,
): Promise<Omit<User, "twoFactorSecret" | "twoFactorSecretEnabled">> {
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
    elo: user.elo,
  };
}

export async function login(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<Omit<User, "twoFactorSecret"> | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    twoFactorSecretEnabled: user.twoFactorSecretEnabled,
    createdAt: user.createdAt.toISOString(),
    elo: user.elo,
  };
}

export async function deleteAccount(
  prisma: PrismaClient,
  userId: string,
  password: string,
  code?: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.password) return false;

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return false;

  if (user.twoFactorSecretEnabled) {
    if (!code || !user.twoFactorSecret) return false;
    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret }))
      return false;
  }

  await prisma.user.delete({ where: { id: userId } });
  return true;
}

export async function getMe(
  prisma: PrismaClient,
  id: string,
): Promise<Omit<User, "twoFactorSecret"> | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    twoFactorSecretEnabled: user.twoFactorSecretEnabled,
    createdAt: user.createdAt.toISOString(),
    elo: user.elo,
  };
}

export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
  code?: string,
): Promise<"OK" | "INVALID_CREDENTIALS" | "SAME_PASSWORD"> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.password) return "INVALID_CREDENTIALS";

  const validPassword = await bcrypt.compare(currentPassword, user.password);
  if (!validPassword) return "INVALID_CREDENTIALS";

  if (user.twoFactorSecretEnabled) {
    if (!code || !user.twoFactorSecret) return "INVALID_CREDENTIALS";
    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      return "INVALID_CREDENTIALS";
    }
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) return "SAME_PASSWORD";

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return "OK";
}
