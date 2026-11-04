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

// Payload returned by the GET /conversations/:otherUserId/messages endpoint
export interface GetConversationHistoryResponse {
  messages: DirectMessage[];
}
