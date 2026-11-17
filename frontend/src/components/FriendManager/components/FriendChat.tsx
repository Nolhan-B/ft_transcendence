import { useEffect, useState } from "react";
import { DirectMessage, Profile } from "shared";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";
import { useAuth } from "../../../hooks/auth/useAuth";

export type FriendChatProps = {
  profile: Profile;
};

export default function FriendChat({ profile }: FriendChatProps) {
  const [chatHistory, setChatHistory] = useState<DirectMessage[]>([]);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchChatHistory() {
      setChatHistoryError(null);
      try {
        const res = await fetch(
          `/api/chat/conversations/${profile.id}/messages`,
          {
            method: "GET",
            credentials: "include",
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { messages: DirectMessage[] };
        setChatHistory(data.messages);
      } catch (err) {
        setChatHistoryError(
          err instanceof Error ? err.message : "Unknown error",
        );
      }
    }

    fetchChatHistory();
  }, [profile.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {chatHistoryError && (
          <p className="text-sm text-error">{chatHistoryError}</p>
        )}
        {!chatHistoryError && chatHistory.length === 0 && (
          <p className="my-auto text-center text-sm opacity-50">
            No messages yet. Say hi to {profile.username}!
          </p>
        )}
        {chatHistory.map((message) => (
          <div
            key={message.id}
            className={
              message.senderId == profile.id
                ? "chat chat-start"
                : "chat chat-end"
            }
          >
            <div className="chat-image avatar">
              <div className="w-10 rounded-full">
                <img
                  alt="Tailwind CSS chat bubble component"
                  src={
                    message.senderId == profile.id
                      ? profile.avatarUrl
                        ? profile.avatarUrl
                        : defaultProfilePicture
                      : user?.avatarUrl
                        ? user.avatarUrl
                        : defaultProfilePicture
                  }
                />
              </div>
            </div>
            <div className="chat-header">
              {message.senderId == profile.id
                ? profile.username
                : user?.username}
              <time className="text-xs opacity-50">
                {new Date(message.createdAt).toLocaleTimeString()}
              </time>
            </div>
            <div className="chat-bubble text-sm">{message.content}</div>
          </div>
        ))}
      </div>
      <form className="flex shrink-0 items-center gap-2">
        <input
          type="text"
          placeholder="Your message"
          aria-label="Your message"
          className="input input-sm w-full flex-1"
        />
        <button
          type="submit"
          className="btn border-0 bg-secondary text-secondary-content"
        >
          Send
        </button>
      </form>
    </div>
  );
}
