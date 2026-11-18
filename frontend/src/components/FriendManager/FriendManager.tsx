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
  }, [friendRequests]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-1">
      <div className="flex shrink-0 flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide uppercase opacity-60">
          Add a friend
        </h2>
        <AddFriendField onAdd={handleAddFriend} />
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-60">
          Pending requests
          {friendRequests.length > 0 && (
            <span className="badge badge-warning badge-xs">
              {friendRequests.length}
            </span>
          )}
        </h2>
        {friendRequestsError ? (
          <p className="text-sm text-error">
            Could not load requests: {friendRequestsError}
          </p>
        ) : friendRequests.length === 0 ? (
          <p className="text-sm opacity-50">No pending requests</p>
        ) : (
          <div className="flex flex-col gap-1">
            {friendRequests.map((request) => (
              <FriendRequestItem
                key={request.id}
                name={request.username}
                avatarUrl={request.avatarUrl}
                onAccept={() => handleAcceptFriendRequest(request.id)}
                onDecline={() => handleDeclineFriendRequest(request.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="divider my-0"></div>

      {currentOpenedFriendChat ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 items-center gap-2 rounded-box bg-base-200 p-1">
            <button
              type="button"
              onClick={() => setCurrentOpenedFriendChat(null)}
              aria-label="Back to friends list"
              className="btn btn-ghost btn-sm btn-circle"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {currentOpenedFriendChat.username}
            </span>
          </div>
          <FriendChat profile={currentOpenedFriendChat} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <h2 className="flex shrink-0 items-center gap-2 text-xs font-semibold tracking-wide uppercase opacity-60">
            Friends
            {!loading && friends.length > 0 && (
              <span className="badge badge-ghost badge-xs">
                {friends.length}
              </span>
            )}
          </h2>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {friendListError ? (
              <p className="text-sm text-error">
                Could not load friends: {friendListError}
              </p>
            ) : loading ? (
              <p className="flex items-center gap-2 text-sm opacity-50">
                <span className="loading loading-spinner loading-xs" />
                Loading friends…
              </p>
            ) : friends.length === 0 ? (
              <p className="text-sm opacity-50">You have no friends :(</p>
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
        </div>
      )}
    </div>
  );
}
