import { useEffect, useState } from "react";
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
  const { friends, friendRequests, setFriendRequests, error } = useChat();

  const [friendRequestsError, setFriendRequestsError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (currentOpenedFriendChat && !friends.includes(currentOpenedFriendChat)) {
      setCurrentOpenedFriendChat(null);
    }
  }, [friends]);

  function handleAddFriend(username: string) {
    console.log("WIP, add friend: " + username);
  }

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
        <AddFriendField onAdd={handleAddFriend} />
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
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        Your friends
        {error ? (
          <p className="text-error text-sm">Could not load friends: {error}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm opacity-60">You have no friends :(</p>
        ) : (
          friends.map((friend) => (
            <FriendListItem
              key={friend.id}
              name={friend.username}
              avatarUrl={friend.avatarUrl}
              onRemove={() => handleDeclineFriendRequest(friend.id)}
              onClick={() =>
                currentOpenedFriendChat
                  ? setCurrentOpenedFriendChat(null)
                  : setCurrentOpenedFriendChat(friend)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
