import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

export function handleLeaveRoom(
  ctx: GatewayContext,
  msg: { roomCode: string },
): void {
  ctx.roomManager.leaveRoom(msg.roomCode, ctx.userId);
  const roomSocketSet = ctx.roomSockets.get(msg.roomCode);
  if (roomSocketSet) {
    for (const client of roomSocketSet) {
      if (client.userId === ctx.userId) {
        roomSocketSet.delete(client);
        break;
      }
    }
  }
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (room) {
    ctx.broadcastToRoomSockets(msg.roomCode, {
      type: "room_updated",
      room: toRoomInfo(room),
    });
  } else {
    ctx.roomSockets.delete(msg.roomCode);
  }
}
