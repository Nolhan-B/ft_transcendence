import { GatewayContext } from "../../types.js";

// Invitation envoyee depuis le chat : l'invite pourra rejoindre la room sans
// son mot de passe. Pas de reponse en cas de succes, le chat envoie le message.
export async function handleInviteToRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; userId: string },
): Promise<void> {
  // Pas d'invitation entre deux joueurs dont l'un a bloque l'autre (le
  // message du chat est deja refuse, mais l'invitation laissait entrer dans
  // une room privee sans son mot de passe)
  const block = await ctx.fastify.prisma.blockedFriendship.findFirst({
    where: {
      OR: [
        { blockerId: ctx.userId, blockedId: msg.userId },
        { blockerId: msg.userId, blockedId: ctx.userId },
      ],
    },
    select: { id: true },
  });
  if (block) {
    ctx.sendError(ctx.socket, "Cannot invite: user is blocked");
    return;
  }

  const result = ctx.roomManager.invite(msg.roomCode, ctx.userId, msg.userId);
  if (!result.ok) ctx.sendError(ctx.socket, result.error);
}
