import type { Profile } from "./user.js";

// Payload sent by the client when sending a direct message via WebSocket
export interface SendDirectMessagePayload {
  type: "direct_message";
  receiverId: string;
  content: string;
  messageType?: "text" | "game_invite";
  gameRoomId?: string;
}

// Direct message entity returned by the database and REST API
export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: "text" | "game_invite";
  gameRoomId?: string | null;
  createdAt: string; // ISO format string in JSON
  delivered: boolean;
}

// Real-time event dispatched over WebSocket (message entity + discriminant event type)
export interface DirectMessageEvent extends DirectMessage {
  type: "direct_message";
}

// Real-time friend lifecycle events relayed from user-service via chat WebSocket
export interface FriendRequestReceivedEvent {
  type: "friend_request_received";
  sender: Profile;
}

export interface FriendRequestAcceptedEvent {
  type: "friend_request_accepted";
  friend: Profile;
}

export interface FriendRemovedEvent {
  type: "friend_removed";
  userId: string;
}

export type FriendSocketEvent =
  FriendRequestReceivedEvent | FriendRequestAcceptedEvent | FriendRemovedEvent;

export type ChatServerEvent =
  DirectMessageEvent | FriendSocketEvent | { type: "error"; message: string };

// Payload returned by the GET /conversations/:otherUserId/messages endpoint
export interface GetConversationHistoryResponse {
  messages: DirectMessage[];
}
