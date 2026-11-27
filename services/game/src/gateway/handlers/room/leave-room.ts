import { GatewayContext } from "../../types.js";
import { leaveRoomFully } from "./lobby-rules.js";

export function handleLeaveRoom(
  ctx: GatewayContext,
  msg: { roomCode: string },
): void {
  // Tous ses onglets quittent la room avec lui
  leaveRoomFully(ctx, msg.roomCode);
}
