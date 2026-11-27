import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";
import {
  isPlayingAGame,
  leaveOtherRooms,
  leaveQueueIfQueued,
} from "./lobby-rules.js";

export async function handleJoinRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; password?: string },
): Promise<void> {
  if (isPlayingAGame(ctx)) {
    ctx.sendError(ctx.socket, "Already in a game");
    return;
  }
  const user = await ctx.fastify.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { username: true },
  });
  if (!user) {
    ctx.sendError(ctx.socket, "User not found");
    return;
  }

  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) {
    ctx.sendError(ctx.socket, "Room not found");
    return;
  }

  const alreadyIn = room.players.some((p) => p.id === ctx.userId);

  if (!alreadyIn) {
    const result = ctx.roomManager.joinRoom(
      msg.roomCode,
      ctx.userId,
      user.username,
      msg.password,
    );
    if (!result.ok) {
      ctx.sendError(ctx.socket, result.error);
      return;
    }
  }

  // Seulement une fois entre : une invitation perimee ou un mauvais mot de
  // passe ne fait pas perdre la room ou la place dans la file
  leaveOtherRooms(ctx, msg.roomCode);
  leaveQueueIfQueued(ctx);

  if (!ctx.roomSockets.has(msg.roomCode))
    ctx.roomSockets.set(msg.roomCode, new Set());
  ctx.roomSockets
    .get(msg.roomCode)!
    .add({ socket: ctx.socket, userId: ctx.userId });
  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "room_updated",
    room: toRoomInfo(room),
  });
}
