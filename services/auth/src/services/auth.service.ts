import bcrypt from "bcrypt";
import { PrismaClient } from "shared";
import type { User } from "shared";
import { authenticator } from "@otplib/preset-default";

// Compared against when the email is unknown, so that a login takes the same
// time whether the account exists or not (security audit F-09)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Emails are compared without case: "Bob@X.com" and "bob@x.com" are the same
// account (security audit F-17). They are stored in lower case.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Usernames are unique without case either: "Bob" and "bob" cannot coexist
// (security audit F-17). They keep the case the user typed, for display.
export async function isUsernameTaken(
  prisma: PrismaClient,
  username: string,
  exceptUserId?: string,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username.normalize("NFKC"), mode: "insensitive" },
      ...(exceptUserId && { NOT: { id: exceptUserId } }),
    },
    select: { id: true },
  });
  return user !== null;
}

export async function isEmailTaken(
  prisma: PrismaClient,
  email: string,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
    select: { id: true },
  });
  return user !== null;
}

export async function signup(
  prisma: PrismaClient,
  email: string,
  username: string,
  password: string,
): Promise<Omit<User, "twoFactorSecret" | "twoFactorSecretEnabled">> {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalizeEmail(email),
      username: username.normalize("NFKC"),
      password: hashedPassword,
    },
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
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
  });
  // Unknown email: same bcrypt work as a real check (audit F-09)
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !user.password || !valid) return null;

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
