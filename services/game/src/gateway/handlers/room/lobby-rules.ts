import { GameStatus } from "shared";
import { GatewayContext } from "../../types.js";
import { toRoomInfo } from "../../utils.js";

// Un joueur est dans une seule chose a la fois : une room, la file ranked, ou
// une partie. Rejoindre une room ou la file quitte l'autre ; une partie en
// cours bloque tout le reste.

// Il joue une partie en cours : il n'en est pas exclu et un de ses sockets la
// suit. Le site rejoint la partie active dans chaque onglet ouvert, donc un
// joueur qui a le site ouvert est bien vu en partie. Une partie quittee depuis
// moins que le delai de reconnexion ne bloque pas : il est sur le point d'en
// etre exclu.
export function isPlayingAGame(ctx: GatewayContext, userId = ctx.userId) {
  for (const [gameId, clients] of ctx.rooms) {
    const game = ctx.manager.getGame(gameId);
    if (!game || game.status !== GameStatus.IN_PROGRESS) continue;
    const me = game.players.find((p) => p.userId === userId);
    if (!me || me.disconnected) continue;
    if ([...clients].some((c) => c.userId === userId)) return true;
  }
  return false;
}

// Retire le joueur de la room : tous ses onglets recoivent room_left, les
// autres joueurs la room a jour. La room disparait s'il n'y reste aucun humain.
export function leaveRoomFully(ctx: GatewayContext, roomCode: string): void {
  ctx.roomManager.leaveRoom(roomCode, ctx.userId);
  const sockets = ctx.roomSockets.get(roomCode);
  if (sockets) {
    for (const client of sockets) {
      if (client.userId !== ctx.userId) continue;
      sockets.delete(client);
      if (client.socket.readyState === client.socket.OPEN)
        client.socket.send(JSON.stringify({ type: "room_left", roomCode }));
    }
  }
  const room = ctx.roomManager.getRoom(roomCode);
  if (room) {
    ctx.broadcastToRoomSockets(roomCode, {
      type: "room_updated",
      room: toRoomInfo(room),
    });
  } else {
    ctx.roomSockets.delete(roomCode);
  }
}

// Quitte toutes les rooms du joueur sauf keepCode
export function leaveOtherRooms(ctx: GatewayContext, keepCode?: string): void {
  for (const room of ctx.roomManager.listRooms()) {
    if (room.code === keepCode) continue;
    if (room.players.some((p) => p.id === ctx.userId))
      leaveRoomFully(ctx, room.code);
  }
}

// Quitte la file ranked, en le disant au socket qui agit
export function leaveQueueIfQueued(ctx: GatewayContext): void {
  if (ctx.queueManager.leave(ctx.userId))
    ctx.socket.send(JSON.stringify({ type: "queue_left" }));
}
