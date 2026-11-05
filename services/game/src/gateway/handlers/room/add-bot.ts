import { randomUUID } from "node:crypto";
import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

export function handleAddBot(ctx: GatewayContext, msg: { roomCode: string }) {
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) return ctx.sendError(ctx.socket, "Room not found");
  if (room.leaderId !== ctx.userId)
    return ctx.sendError(ctx.socket, "Only the owner can add bots");

  if (room.players.length >= room.maxPlayers)
    return ctx.sendError(
      ctx.socket,
      "Max player capacity has already been reached for this room",
    );

  const botNames = [
    "Alice",
    "Bob",
    "Charlie",
    "Diana",
    "Eve",
    "Frank",
    "Grace",
    "Hugo",
  ];
  const usedNames = room.players.map((p) => p.username);
  const name =
    botNames.find((n) => !usedNames.includes(n)) ??
    `Bot ${room.players.length}`;
  const botId = `bot_${randomUUID()}`;
  room.players.push({ id: botId, username: name });

  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "room_updated",
    room: toRoomInfo(room),
  });
}

export function handleRemoveBot(
  ctx: GatewayContext,
  msg: { roomCode: string; botId: string },
) {
  const room = ctx.roomManager.getRoom(msg.roomCode);
  if (!room) return ctx.sendError(ctx.socket, "Room not found");

  if (room.leaderId !== ctx.userId)
    return ctx.sendError(ctx.socket, "Only the owner can remove bots");

  if (!msg.botId.startsWith("bot_"))
    return ctx.sendError(ctx.socket, "Not a bot");

  room.players = room.players.filter((p) => p.id !== msg.botId);

  ctx.broadcastToRoomSockets(msg.roomCode, {
    type: "room_updated",
    room: toRoomInfo(room),
  });
}
