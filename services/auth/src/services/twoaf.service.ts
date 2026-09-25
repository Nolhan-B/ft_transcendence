import { PrismaClient } from '../generated/prisma/client.js';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';

export async function enableTwoFactor(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
    
    const user = await prisma.user.findUnique({where: { id: userId }});
    if (!user) return null

    const secret = authenticator.generateSecret();

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret },
    });

    const otpauthUrl = authenticator.keyuri(user.email, 'ft_transcendence', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return qrCode;


}
