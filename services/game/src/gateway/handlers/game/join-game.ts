import { GatewayContext } from "../../types.js";
import { filterStateForPlayer } from "../../utils.js";
import { leaveOtherGames } from "./leave-other-games.js";

export async function handleJoinGame(
  ctx: GatewayContext,
  msg: { gameId: string },
): Promise<void> {
  const game = ctx.manager.getGame(msg.gameId);
  if (game === undefined) {
    ctx.sendError(ctx.socket, "Game not found");
    return;
  }
  const isPlayer = game.players.some((p) => p.userId === ctx.userId);
  if (!isPlayer) {
    ctx.sendError(ctx.socket, "You are not part of this game");
    return;
  }
  const key = `${msg.gameId}:${ctx.userId}`;
  const pending = ctx.disconnectTimers.get(key);
  if (pending) {
    clearTimeout(pending);
    ctx.disconnectTimers.delete(key);
  }

  // Plus d'etats d'une autre partie sur ce socket (ancienne partie, spectateur)
  leaveOtherGames(ctx, msg.gameId);

  if (!ctx.rooms.has(msg.gameId)) {
    ctx.rooms.set(msg.gameId, new Set());
  }
  // Un meme socket peut renvoyer join_game (retour sur sa partie apres une
  // autre) : une seule entree, sinon chaque evenement arriverait en double
  const clients = ctx.rooms.get(msg.gameId)!;
  for (const client of clients) {
    if (client.socket === ctx.socket) clients.delete(client);
  }
  clients.add({ socket: ctx.socket, userId: ctx.userId });

  ctx.broadCastToRoom(
    msg.gameId,
    { type: "player_joined", userId: ctx.userId },
    ctx.userId,
  );

  const current = game.players.find((p) => p.isCurrentTurn);
  if (
    !ctx.turnTimers.has(msg.gameId) &&
    current &&
    !current.userId.startsWith("bot_")
  ) {
    ctx.startTurnTimer(msg.gameId);
  }

  // Retour apres une coupure : tout le monde doit le voir sortir de
  // reconnecting, l'etat part donc a toute la salle (lui compris)
  if (pending) {
    ctx.broadCastStateToRoom(game.id, game);
    return;
  }

  // Apres le demarrage du chrono : l'etat envoye contient le temps restant
  // (a la reconnexion, celui du chrono deja en cours, pas 20 s)
  const playerGameState = filterStateForPlayer(
    game,
    ctx.userId,
    ctx.liveState(game),
  );
  ctx.socket.send(
    JSON.stringify({ type: "game_updated", state: playerGameState }),
  );
}
