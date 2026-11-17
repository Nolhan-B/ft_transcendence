import { useEffect, useState } from "react";
import type { Profile } from "shared";
import { AddFriendField } from "./components/AddFriendField";
import { FriendListItem } from "./components/FriendListItem";
import { FriendRequestItem } from "./components/FriendRequestItem";
import FriendChat from "./components/FriendChat";
// import { OpenedFriendChat } from "./components/OpenedFriendChat";

export function FriendManager() {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendListError, setFriendListError] = useState<string | null>(null);

  const [friendRequests, setFriendRequests] = useState<Profile[]>([]);
  const [friendRequestsError, setFriendRequestsError] = useState<string | null>(
    null,
  );

  const [currentOpenedFriendChat, setCurrentOpenedFriendChat] =
    useState<Profile | null>(null);

  // Friends list, served by the user service behind the gateway:
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
        setFriendListError(
          err instanceof Error ? err.message : "Unknown error",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchFriends();
  }, []);

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
        setFriendRequestsError(
          err instanceof Error ? err.message : "Unknown error",
        );
      }
    }

    fetchFriendRequests();
  }, []);

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
      {currentOpenedFriendChat ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setCurrentOpenedFriendChat(null)}
              className="btn border-0"
            >
              ←
            </button>
            Chat with {currentOpenedFriendChat.username}
          </div>
          <FriendChat profile={currentOpenedFriendChat} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          Your friends
          {friendListError ? (
            <p className="text-error text-sm">
              Could not load friends: {friendListError}
            </p>
          ) : loading ? (
            <p className="text-sm opacity-60">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm opacity-60">You have no friends :(</p>
          ) : (
            friends.map((friend) => (
              <FriendListItem
                key={friend.id}
                name={friend.username}
                avatarUrl={friend.avatarUrl}
                onRemove={() => handleDeclineFriendRequest(friend.id)}
                onClick={() => setCurrentOpenedFriendChat(friend)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
