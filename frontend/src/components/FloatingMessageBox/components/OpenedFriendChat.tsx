import { DirectMessage } from "shared";
import { ChatMessageComponent } from "./ChatMessageComponent";

// Scrolls a chat to its latest message whenever the element is (re)mounted
const scrollToBottom = (element: HTMLDivElement | null) => {
  if (element) element.scrollTop = element.scrollHeight;
};

export type OpenedFriendChatProps = {
  name?: string | null;
  avatarUrl?: string | null;
  history: DirectMessage[];
};

export function OpenedFriendChat() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <button className="btn" aria-label="Back to friends list">
        <svg
          viewBox="0 0 24 24"
          className="fill-neutral-content size-6"
          aria-hidden="true"
        >
          <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42a.996.996 0 0 0-1.41 0l-6.59 6.59a.996.996 0 0 0 0 1.41l6.59 6.59a.996.996 0 1 0 1.41-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1" />
        </svg>
        Back to friend list
      </button>
      <div
        ref={scrollToBottom}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        <ChatMessageComponent />
        <ChatMessageComponent />
        <ChatMessageComponent />
        <ChatMessageComponent />
        <ChatMessageComponent />
        <ChatMessageComponent />
      </div>
    </div>
  );
}
