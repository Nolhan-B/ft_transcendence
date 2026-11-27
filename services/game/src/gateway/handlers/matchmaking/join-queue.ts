import { GatewayContext } from "../../types.js";
import { leaveOtherRooms } from "../room/lobby-rules.js";

export async function handleJoinQueue(ctx: GatewayContext): Promise<void> {
  if (ctx.queueManager.has(ctx.userId)) {
    ctx.sendError(ctx.socket, "Already in queue");
    return;
  }
  if (ctx.manager.isPlayerInGame(ctx.userId)) {
    ctx.sendError(ctx.socket, "Already in a game");
    return;
  }

  const user = await ctx.fastify.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { username: true, elo: true, avatarUrl: true },
  });
  if (!user) {
    ctx.sendError(ctx.socket, "User not found");
    return;
  }

  // La file remplace la room ou il attendait
  leaveOtherRooms(ctx);

  ctx.queueManager.join({
    userId: ctx.userId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    elo: user.elo,
    joinedAt: Date.now(),
  });

  ctx.socket.send(JSON.stringify({ type: "queue_joined", elo: user.elo }));
}
