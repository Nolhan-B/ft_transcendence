import { GatewayContext } from "../../types.js";

// Invitation envoyee depuis le chat : l'invite pourra rejoindre la room sans
// son mot de passe. Pas de reponse en cas de succes, le chat envoie le message.
export function handleInviteToRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; userId: string },
): void {
  const result = ctx.roomManager.invite(msg.roomCode, ctx.userId, msg.userId);
  if (!result.ok) ctx.sendError(ctx.socket, result.error);
}
