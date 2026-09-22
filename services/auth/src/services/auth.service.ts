
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client.js';

export async function signup(prisma: PrismaClient, email: string, username: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, username, password: hashedPassword },
  });

  return { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
}

export async function login(prisma: PrismaClient, email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return { id: user.id, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
}