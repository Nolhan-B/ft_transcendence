import { useEffect, useRef } from "react";
import type { ServerMessage } from "./types";

type Listener = (msg: ServerMessage) => void;

class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: string[] = [];

  connect(token: string) {
    this.close();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/game/ws?token=${encodeURIComponent(token)}`,
    );

    ws.onopen = () => {
      for (const m of this.queue) ws.send(m);
      this.queue = [];
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data) as ServerMessage;
      } catch {
        return;
      }
      for (const l of this.listeners) l(msg);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
    };

    this.ws = ws;
  }

  send(msg: object) {
    const data = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.queue.push(data);
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.queue = [];
  }
}

export const socket = new GameSocket();

export function useSocketEvent(handler: Listener) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => socket.subscribe((m) => ref.current(m)), []);
}
