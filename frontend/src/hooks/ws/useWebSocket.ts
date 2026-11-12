import { useCallback, useEffect, useRef, useState } from "react";

type Status = "connecting" | "open" | "closed";

interface Options {
  path: string;
  onMessage?: (message: unknown) => void;
}

export function useWebSocket({ path, onMessage }: Options) {
  const [status, setStatus] = useState<Status>("connecting");

  const wsRef = useRef<WebSocket | null>(null);

  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${location.host}${path}`);
      ws = socket;
      wsRef.current = socket;
      socket.addEventListener("open", () => {
        if (active) setStatus("open");
        attempt = 0;
      });
      socket.addEventListener("message", (event) => {
        try {
          onMessageRef.current?.(JSON.parse(event.data));
        } catch {
          console.log("WS message ignoré (JSON invalide)", event.data);
        }
      });

      socket.addEventListener("close", () => {
        if (!active) return;
        setStatus("closed");
        attempt++;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        timer = setTimeout(() => {
          setStatus("connecting");
          connect();
        }, delay);
      });
      socket.addEventListener("error", () => console.log("WS error"));
    }
    // The connection is opened after a 0 ms timer: StrictMode runs the effect,
    // cleans it up, then runs it again. The first cleanup cancels the timer, so
    // only one socket is opened (the server accepts one per user).
    timer = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
      wsRef.current = null;
      ws?.close();
    };
  }, [path]);

  const send = useCallback((message: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  return { status, send };
}
