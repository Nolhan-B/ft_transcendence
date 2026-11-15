import { useEffect, useState } from "react";
import type { Profile } from "shared";
import { AddFriendField } from "./AddFriendField";
import { FriendListItem } from "./FriendListItem";
// import { OpenedFriendChat } from "./OpenedFriendChat";

export function FriendChat() {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchFriends();
  }, []);

  // The friend request API works with user ids, not usernames, and no route
  // resolves a username yet: fill this in once /api/user has that lookup.
  function handleAddFriend(username: string) {
    console.log("WIP, add friend: " + username);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
      <AddFriendField onAdd={handleAddFriend} />

      {error ? (
        <p className="text-error text-sm">Could not load friends: {error}</p>
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
          />
        ))
      )}
      <FriendListItem />
      <FriendListItem />
      <FriendListItem />
      {/* <OpenedFriendChat /> */}
    </div>
  );
}
