import { GatewayContext } from "../../types.js";

export function handleLeaveSpectate(
  ctx: GatewayContext,
  msg: { gameId: string },
): void {
  const watchers = ctx.spectators.get(msg.gameId);
  if (!watchers) return;

  for (const client of watchers) {
    if (client.socket === ctx.socket) watchers.delete(client);
  }
  if (watchers.size === 0) ctx.spectators.delete(msg.gameId);
}
