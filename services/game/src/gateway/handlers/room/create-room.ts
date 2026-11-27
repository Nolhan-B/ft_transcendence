import { GameMode } from "shared";
import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";
import {
  isPlayingAGame,
  leaveOtherRooms,
  leaveQueueIfQueued,
} from "./lobby-rules.js";

export async function handleCreateRoom(
  ctx: GatewayContext,
  msg: { mode: GameMode; maxPlayers: number; name: string; password?: string },
): Promise<void> {
  if (msg.mode === GameMode.RANKED) {
    ctx.sendError(
      ctx.socket,
      "Ranked games are only available through matchmaking",
    );
    return;
  }
  if (isPlayingAGame(ctx)) {
    ctx.sendError(ctx.socket, "Already in a game");
    return;
  }
  const user = await ctx.fastify.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { username: true, avatarUrl: true },
  });
  if (!user) {
    ctx.sendError(ctx.socket, "User not found");
    return;
  }
  // Une room a la fois : la nouvelle remplace l'ancienne et la file
  leaveOtherRooms(ctx);
  leaveQueueIfQueued(ctx);
  const roomCode = ctx.roomManager.createRoom(
    ctx.userId,
    user.username,
    msg.mode,
    msg.maxPlayers,
    msg.name.trim(),
    msg.password,
    user.avatarUrl,
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
