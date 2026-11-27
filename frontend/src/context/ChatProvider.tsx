import { useCallback, useMemo, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  DirectMessage,
  ChatServerEvent,
  GetConversationHistoryResponse,
  Profile,
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
  const [friendRequests, setFriendRequests] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<
    Record<string, DirectMessage[]>
  >({});
  const [unreadSenders, setUnreadSenders] = useState<string[]>([]);
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
      const event = message as ChatServerEvent;
      if (event.type === "direct_message") {
        const otherUserId =
          event.senderId === user?.id ? event.receiverId : event.senderId;
        // Add the sender to the list of unread messages
        if (user && event.senderId !== user.id) {
          setUnreadSenders((all) =>
            all.includes(event.senderId) ? all : [...all, event.senderId],
          );
        }
        addMessages(otherUserId, [event]);
      } else if (event.type === "friend_request_received") {
        setFriendRequests((prev) => {
          const alreadyThere = prev.some(
            (request) => request.id === event.sender.id,
          );
          if (alreadyThere) return prev;
          return [...prev, event.sender];
        });
      } else if (event.type === "friend_request_accepted") {
        setFriendRequests((prev) => {
          return prev.filter((request) => request.id !== event.friend.id);
        });
        setFriends((prev) => {
          return [...prev, event.friend];
        });
      } else if (event.type === "friend_removed") {
        setFriendRequests((prev) => {
          return prev.filter((request) => request.id !== event.userId);
        });
        setFriends((prev) => {
          return prev.filter((request) => request.id !== event.userId);
        });
      } else if (event.type === "error") {
        setError(event.message);
      }
    },
  });

  useEffect(() => {
    async function fetchFriendRequests() {
      try {
        const res = await fetch("/api/user/friends/requests/received", {
          credentials: "include", // the session lives in an httpOnly cookie
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { receivedRequests: Profile[] };
        setFriendRequests(data.receivedRequests);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error during the fetch of the friend requests",
        );
      }
    }

    fetchFriendRequests();
  }, [user?.id]);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch("/api/user/friends", {
          credentials: "include", // the session lives in an httpOnly cookie
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { friends: Profile[] };
        setFriends(data.friends);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    fetchFriends();
  }, [friendRequests]);

  const sendMessage = useCallback(
    (receiverId: string, content: string) => {
      setError(null);
      send({ type: "direct_message", receiverId, content });
    },
    [send],
  );

  const sendGameInvite = useCallback(
    (receiverId: string, roomCode: string) => {
      setError(null);
      send({
        type: "direct_message",
        receiverId,
        // Readable as is where invites are not rendered (old clients...)
        content: `Join my UNO room #${roomCode}!`,
        messageType: "game_invite",
        gameRoomId: roomCode,
      });
    },
    [send],
  );

  const forgetUser = useCallback((userId: string) => {
    setFriends((all) => all.filter((f) => f.id !== userId));
    setFriendRequests((all) => all.filter((f) => f.id !== userId));
    setUnreadSenders((all) => all.filter((id) => id !== userId));
    setConversations((all) => {
      const rest = { ...all };
      delete rest[userId];
      return rest;
    });
  }, []);

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
  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<ChatContextValue>(
    () => ({
      status,
      conversations,
      friendRequests,
      friends,
      setFriendRequests,
      unreadSenders,
      setUnreadSenders,
      error,
      clearError,
      sendMessage,
      sendGameInvite,
      forgetUser,
      loadHistory,
    }),
    [
      status,
      conversations,
      friendRequests,
      friends,
      setFriendRequests,
      unreadSenders,
      setUnreadSenders,
      error,
      clearError,
      sendMessage,
      sendGameInvite,
      forgetUser,
      loadHistory,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
