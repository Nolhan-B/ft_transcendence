import { GatewayContext } from "../../types.js";

export function handleChatMessage(
  ctx: GatewayContext,
  msg: { gameId: string; content: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }
  const player = game.players.find((p) => p.userId === ctx.userId);

  if (!ctx.chatLogs.has(msg.gameId)) ctx.chatLogs.set(msg.gameId, []);
  ctx.chatLogs.get(msg.gameId)!.push({
    userId: ctx.userId,
    username: player?.username ?? "",
    content: msg.content,
    time: new Date().toISOString(),
  });

  ctx.broadCastToRoom(msg.gameId, {
    type: "chat_message",
    userId: ctx.userId,
    username: player?.username ?? "",
    content: msg.content,
  });
}
