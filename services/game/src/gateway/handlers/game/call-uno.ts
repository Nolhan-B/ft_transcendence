import { GatewayContext } from "../../types.js";

export function handleCallUno(ctx: GatewayContext): void {
  if (ctx.unoTimers.has(ctx.userId)) {
    clearTimeout(ctx.unoTimers.get(ctx.userId));
    ctx.unoTimers.delete(ctx.userId);
  }
}
