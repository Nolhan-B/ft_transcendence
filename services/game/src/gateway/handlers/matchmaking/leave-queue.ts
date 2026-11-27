import { GatewayContext } from "../../types.js";

export function handleLeaveQueue(ctx: GatewayContext): void {
  if (!ctx.queueManager.leave(ctx.userId)) {
    ctx.sendError(ctx.socket, "Not in queue");
    return;
  }
  ctx.socket.send(JSON.stringify({ type: "queue_left" }));
}
