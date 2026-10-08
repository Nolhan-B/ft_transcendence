import { FastifyInstance } from "fastify";
import { WebSocket } from "@fastify/websocket";
import { GameManager } from "../managers/game.manager.js";
import type { ClientMessage } from "shared";

const manager = new GameManager();
const rooms: Map<
  string,
  Set<{ socket: WebSocket; userId: string }>
> = new Map();

export default async function gameGateway(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    socket.on("message", (data) => {
      // data = le message brut envoyé par le client
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case "join_game":
          // message.gameId est typé
          break;
        case "play_card":
          // message.gameId, message.cardId, message.chosenColor sont typés
          break;
        case "draw_card":
          // message.gameId est typé
          break;
      }
    });

    socket.on("close", () => {
      // le joueur s'est déconnecté
    });

    socket.send(JSON.stringify({ type: "connected" }));
    // envoie un message au client
  });
}
