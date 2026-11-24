import { GameSettings } from "shared";
import { GatewayContext } from "../../types.js";
import { pickSettings, toRoomInfo } from "../../utils.js";

export function handleUpdateRoom(
  ctx: GatewayContext,
  msg: { roomCode: string; settings: GameSettings },
): void {
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) {
    ctx.sendError(ctx.socket, "Room not found");
    return;
  }
  if (room.leaderId !== ctx.userId) {
    ctx.sendError(ctx.socket, "Only the leader can update settings");
    return;
  }
  // msg.settings est deja valide par validateMessage
  ctx.roomManager.updateSettings(
    msg.roomCode,
    ctx.userId,
    pickSettings(msg.settings),
  );
  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "room_updated",
    room: toRoomInfo(room),
  });
}
