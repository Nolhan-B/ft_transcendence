import { GatewayContext } from "../../types.js";

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
    select: { username: true, elo: true },
  });
  if (!user) {
    ctx.sendError(ctx.socket, "User not found");
    return;
  }

  ctx.queueManager.join({
    userId: ctx.userId,
    username: user.username,
    elo: user.elo,
    joinedAt: Date.now(),
  });

  ctx.socket.send(JSON.stringify({ type: "queue_joined", elo: user.elo }));
}
