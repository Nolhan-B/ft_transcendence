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
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {chatHistoryError && (
          <p className="text-error text-sm">{chatHistoryError}</p>
        )}
        {chatHistory.map((message) => (
          <div
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
            <div className="chat-bubble text-xs">{message.content}</div>
          </div>
        ))}
      </div>
      <form className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Your message"
          className="flex flex-1 input input-sm"
        />
        <button className="btn border-0 bg-secondary text-secondary-content">
          Send
        </button>
      </form>
    </div>
  );
}
