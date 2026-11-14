import { createContext } from "react";
import type { DirectMessage } from "shared";
import type { Status } from "../hooks/ws/useWebSocket";

export interface ChatContextValue {
  status: Status;
  conversations: Record<string, DirectMessage[]>;
  error: string | null;
  sendMessage: (receiverId: string, content: string) => void;
  loadHistory: (otherUserId: string) => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
