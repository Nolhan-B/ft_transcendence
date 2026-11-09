import { GameStatus } from "shared";
import { GatewayContext } from "../../types.js";
import { filterStateForSpectator } from "../../utils.js";

export function handleSpectateGame(
  ctx: GatewayContext,
  msg: { gameId: string },
): void {
  const game = ctx.manager.getGame(msg.gameId);
  if (!game || game.status === GameStatus.FINISHED) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }

  // Un joueur de la partie doit passer par join_game, pas par le mode spectateur
  if (game.players.some((p) => p.userId === ctx.userId)) {
    ctx.sendError(ctx.socket, "You are a player in this game");
    return;
  }

  if (!ctx.spectators.has(msg.gameId)) {
    ctx.spectators.set(msg.gameId, new Set());
  }
  const watchers = ctx.spectators.get(msg.gameId)!;

  // Evite les doublons si le même socket envoie spectate_game deux fois
  for (const client of watchers) {
    if (client.socket === ctx.socket) watchers.delete(client);
  }
  watchers.add({ socket: ctx.socket, userId: ctx.userId });

  ctx.socket.send(
    JSON.stringify({
      type: "spectate_started",
      state: filterStateForSpectator(game),
    }),
  );
}
