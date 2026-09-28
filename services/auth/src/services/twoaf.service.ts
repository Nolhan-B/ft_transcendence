import { PrismaClient } from '../generated/prisma/client.js';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import { User } from 'shared';
import bcrypt from 'bcrypt';

export async function enableTwoFactor(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const secret = authenticator.generateSecret();

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  const otpauthUrl = authenticator.keyuri(
    user.email,
    'ft_transcendence',
    secret,
  );
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return qrCode;
}

export async function verifyTwoFactor(
  prisma: PrismaClient,
  userId: string,
  code: string,
): Promise<Omit<User, 'twoFactorSecret'> | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (!user.twoFactorSecret) return null;

  if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecretEnabled: true },
    });
    if (!updatedUser) return null;
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      twoFactorSecretEnabled: updatedUser.twoFactorSecretEnabled,
      createdAt: updatedUser.createdAt.toISOString(),
    };
  }
  return null;
}

export async function validateTwoFactor(
  prisma: PrismaClient,
  userId: string,
  code: string,
): Promise<Omit<User, 'twoFactorSecret'> | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (!user.twoFactorSecret) return null;

  if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
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
  return null
}

export async function disableTwoFactor(
  prisma: PrismaClient,
  userId: string,
  password: string,
  code: string,
): Promise<Omit<User, 'twoFactorSecret'> | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  if (!user.twoFactorSecret) return null;

  if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorSecretEnabled: false },
    });
    if (!updatedUser) return null;
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      twoFactorSecretEnabled: updatedUser.twoFactorSecretEnabled,
      createdAt: updatedUser.createdAt.toISOString(),
    };
  }
  return null;
}
