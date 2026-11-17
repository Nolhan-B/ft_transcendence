import React, { useEffect, useState, useRef } from "react";
import { Profile } from "shared";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";
import { useAuth } from "../../../hooks/auth/useAuth";
import { useChat } from "../../../hooks/ws/useChat";

export type FriendChatProps = {
  profile: Profile;
};

const scrollToBottom = (element: HTMLDivElement | null) => {
  if (element) element.scrollTop = element.scrollHeight;
};

export default function FriendChat({ profile }: FriendChatProps) {
  const { user } = useAuth();
  const { conversations, loadHistory, sendMessage, status } = useChat();
  const chatHistory = conversations[profile.id] ?? [];
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadHistory(profile.id);
  }, [profile.id, loadHistory]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (text === "" || status !== "open") return;
    sendMessage(profile.id, text);
    setDraft("");
  }

  useEffect(() => {
    scrollToBottom(bottomRef.current);
  }, [chatHistory.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={bottomRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        {chatHistory.length === 0 && (
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
      <form
        className="flex shrink-0 items-center gap-2"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          placeholder="Your message"
          aria-label="Your message"
          className="input input-sm w-full flex-1"
          onChange={(e) => setDraft(e.target.value)}
          value={draft}
          maxLength={2000}
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
