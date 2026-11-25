import { createContext } from "react";
import type { DirectMessage, Profile } from "shared";
import type { Status } from "../hooks/ws/useWebSocket";
import type { Dispatch, SetStateAction } from "react";

export interface ChatContextValue {
  status: Status;
  conversations: Record<string, DirectMessage[]>;
  friendRequests: Profile[];
  friends: Profile[];
  unreadSenders: string[];
  setUnreadSenders: Dispatch<SetStateAction<string[]>>;
  setFriendRequests: Dispatch<SetStateAction<Profile[]>>;
  error: string | null;
  clearError: () => void;
  sendMessage: (receiverId: string, content: string) => void;
  // A message holding the code of a game room, shown with a "Join" button
  sendGameInvite: (receiverId: string, roomCode: string) => void;
  // Removes a user from my friends, requests, unread list and chats (after
  // I blocked them)
  forgetUser: (userId: string) => void;
  loadHistory: (otherUserId: string) => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | null>(null);
