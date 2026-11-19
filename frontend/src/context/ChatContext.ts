import { createContext } from "react";
import type { DirectMessage, Profile } from "shared";
import type { Status } from "../hooks/ws/useWebSocket";
import type { Dispatch, SetStateAction } from "react";

export interface ChatContextValue {
  status: Status;
  conversations: Record<string, DirectMessage[]>;
  friendRequests: Profile[];
  friends: Profile[];
  setFriendRequests: Dispatch<SetStateAction<Profile[]>>;
  error: string | null;
  clearError: () => void;
  sendMessage: (receiverId: string, content: string) => void;
  loadHistory: (otherUserId: string) => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
