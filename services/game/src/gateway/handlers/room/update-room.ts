import { GameSettings } from "shared";
import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

export function handleUpdateRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; settings: GameSettings },
): void {
  ctx.roomManager.updateSettings(msg.roomCode, ctx.userId, msg.settings);
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) {
    ctx.sendError(ctx.socket, "Room not found");
    return;
  }
  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "room_updated",
    room: toRoomInfo(room),
  });
}
