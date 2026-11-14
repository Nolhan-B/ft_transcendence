import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  DirectMessage,
  DirectMessageEvent,
  GetConversationHistoryResponse,
} from "shared";
import { useAuth } from "../hooks/auth/useAuth";
import { useWebSocket } from "../hooks/ws/useWebSocket";
import { ChatContext } from "./ChatContext";
import type { ChatContextValue } from "./ChatContext";

function merge(
  current: DirectMessage[] = [],
  incoming: DirectMessage[],
): DirectMessage[] {
  const known = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  return [...current, ...added].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<
    Record<string, DirectMessage[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const addMessages = useCallback(
    (otherUserId: string, messages: DirectMessage[]) => {
      setConversations((prev) => ({
        ...prev,
        [otherUserId]: merge(prev[otherUserId], messages),
      }));
    },
    [],
  );
  const { status, send } = useWebSocket({
    path: "/api/chat/ws",
    onMessage: (message) => {
      const event = message as
        DirectMessageEvent | { type: "error"; message: string };
      if (event.type === "direct_message") {
        const otherUserId =
          event.senderId === user?.id ? event.receiverId : event.senderId;
        addMessages(otherUserId, [event]);
      } else if (event.type === "error") {
        setError(event.message);
      }
    },
  });
  const sendMessage = useCallback(
    (receiverId: string, content: string) => {
      setError(null);
      send({ type: "direct_message", receiverId, content });
    },
    [send],
  );

  const loadHistory = useCallback(
    async (otherUserId: string) => {
      const response = await fetch(
        `/api/chat/conversations/${otherUserId}/messages`,
        { credentials: "include" },
      );
      if (!response.ok) {
        setError("Unable to load the message history.");
        return;
      }
      const data: GetConversationHistoryResponse = await response.json();
      addMessages(otherUserId, data.messages);
    },
    [addMessages],
  );
  const value = useMemo<ChatContextValue>(
    () => ({ status, conversations, error, sendMessage, loadHistory }),
    [status, conversations, error, sendMessage, loadHistory],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
