import { useEffect, useMemo, useState } from "react";
import type { Profile } from "shared";
import { AddFriendField } from "./components/AddFriendField";
import { FriendListItem } from "./components/FriendListItem";
import { FriendRequestItem } from "./components/FriendRequestItem";
import { useChat } from "../../hooks/ws/useChat";

export type FriendManagerProps = {
  currentOpenedFriendChat: Profile | null;
  setCurrentOpenedFriendChat: (profile: Profile | null) => void;
};

export function FriendManager({
  currentOpenedFriendChat,
  setCurrentOpenedFriendChat,
}: FriendManagerProps) {
  const {
    friends,
    conversations,
    friendRequests,
    setFriendRequests,
    error,
    setUnreadSenders,
    unreadSenders,
  } = useChat();

  const [friendRequestsError, setFriendRequestsError] = useState<string | null>(
    null,
  );

  // Friends with a new message first, then the latest conversations (a
  // message sent or received moves the friend up), then the others in
  // their usual order
  const sortedFriends = useMemo(() => {
    const lastMessageAt = (id: string) => {
      const messages = conversations[id];
      return messages?.[messages.length - 1]?.createdAt ?? "";
    };
    const usual = new Map(friends.map((f, i) => [f.id, i]));
    return [...friends].sort((a, b) => {
      const unreadA = unreadSenders.includes(a.id);
      const unreadB = unreadSenders.includes(b.id);
      if (unreadA !== unreadB) return unreadA ? -1 : 1;
      const latest = lastMessageAt(b.id).localeCompare(lastMessageAt(a.id));
      if (latest !== 0) return latest;
      return (usual.get(a.id) ?? 0) - (usual.get(b.id) ?? 0);
    });
  }, [friends, conversations, unreadSenders]);

  function removeNotification(uid: string) {
    if (!uid) return;
    setUnreadSenders((all) => all.filter((id) => id !== uid));
  }

  useEffect(() => {
    if (
      currentOpenedFriendChat &&
      unreadSenders.includes(currentOpenedFriendChat?.id)
    ) {
      const id = currentOpenedFriendChat.id;
      removeNotification(id);
    }
  }, [unreadSenders, currentOpenedFriendChat]);

  // Close chat if friend is removed
  useEffect(() => {
    if (!friends.some((f) => f.id === currentOpenedFriendChat?.id)) {
      setCurrentOpenedFriendChat(null);
    }
  }, [friends]);

  async function handleAcceptFriendRequest(userId: string) {
    try {
      const res = await fetch(`/api/user/friends/accept/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Remove friend from pending list
      setFriendRequests((all) => all.filter((r) => r.id !== userId));
    } catch (err) {
      setFriendRequestsError(
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }

  async function handleDeclineFriendRequest(userId: string) {
    try {
      const res = await fetch(`/api/user/friends/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Remove friend from pending list
      setFriendRequests((all) => all.filter((r) => r.id !== userId));
    } catch (err) {
      setFriendRequestsError(
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 pt-1">
      <div className="flex shrink-0 flex-col gap-1">
        Send a friend request
        <AddFriendField />
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        Pending Friend requests
        {friendRequestsError ? (
          <p className="text-error text-sm">
            Could not load requests: {friendRequestsError}
          </p>
        ) : friendRequests.length === 0 ? (
          <p className="text-sm opacity-60">No pending requests</p>
        ) : (
          friendRequests.map((request) => (
            <FriendRequestItem
              key={request.id}
              name={request.username}
              avatarUrl={request.avatarUrl}
              onAccept={() => handleAcceptFriendRequest(request.id)}
              onDecline={() => handleDeclineFriendRequest(request.id)}
            />
          ))
        )}
      </div>
      <div className="divider"></div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
        Your friends
        {error ? (
          <p className="text-error text-sm">Could not load friends: {error}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm opacity-60">You have no friends :(</p>
        ) : (
          sortedFriends.map((friend) => (
            <FriendListItem
              key={friend.id}
              name={friend.username}
              avatarUrl={friend.avatarUrl}
              uid={friend.id}
              onRemove={() => handleDeclineFriendRequest(friend.id)}
              currentOpenedChat={currentOpenedFriendChat}
              // Another friend replaces the open chat; the open one closes it
              onClick={() =>
                setCurrentOpenedFriendChat(
                  currentOpenedFriendChat?.id === friend.id ? null : friend,
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
