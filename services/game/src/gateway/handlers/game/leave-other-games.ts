import { GatewayContext } from "../../types.js";

// Un socket ne suit qu'une partie a la fois. Avant de rejoindre ou de regarder
// la partie keepGameId, on le retire :
// - des parties dont ce joueur a ete exclu (AFK, abandon) : sans ca, il
//   recevait encore leurs etats et l'ecran sautait d'une partie a l'autre ;
// - de toutes les autres parties qu'il regardait en spectateur.
// On ne le retire PAS d'une partie ou il joue encore : la detection de
// deconnexion de cette partie a besoin de son socket.
export function leaveOtherGames(ctx: GatewayContext, keepGameId: string): void {
  for (const [gameId, clients] of ctx.rooms) {
    if (gameId === keepGameId) continue;
    const game = ctx.manager.getGame(gameId);
    const me = game?.players.find((p) => p.userId === ctx.userId);
    // Partie terminee, inconnue, ou joueur exclu : plus rien a suivre
    if (game && me && !me.disconnected) continue;
    for (const client of clients) {
      if (client.socket === ctx.socket) clients.delete(client);
    }
  }

  for (const [gameId, watchers] of ctx.spectators) {
    if (gameId === keepGameId) continue;
    for (const client of watchers) {
      if (client.socket === ctx.socket) watchers.delete(client);
    }
    if (watchers.size === 0) ctx.spectators.delete(gameId);
  }
}
