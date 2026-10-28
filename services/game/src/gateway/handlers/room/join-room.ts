import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

export async function handleJoinRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; password?: string },
): Promise<void> {
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
