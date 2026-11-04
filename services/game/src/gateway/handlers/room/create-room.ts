import { GameMode } from "shared";
import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

export async function handleCreateRoom(
  ctx: GatewayContext,
  msg: { mode: GameMode; maxPlayers: number; name: string; password?: string },
): Promise<void> {
  const user = await ctx.fastify.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { username: true },
  });
  if (!user) {
    ctx.sendError(ctx.socket, "User not found");
    return;
  }
  const roomCode = ctx.roomManager.createRoom(
    ctx.userId,
    user.username,
    msg.mode,
    msg.maxPlayers,
    msg.name,
    msg.password,
  );
  if (!ctx.roomSockets.has(roomCode)) ctx.roomSockets.set(roomCode, new Set());
  ctx.roomSockets
    .get(roomCode)!
    .add({ socket: ctx.socket, userId: ctx.userId });
  ctx.socket.send(
    JSON.stringify({
      type: "room_updated",
      room: toRoomInfo(ctx.roomManager.getRoom(roomCode)!),
    }),
  );
}
