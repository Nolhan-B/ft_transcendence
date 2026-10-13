// Payload sent by the client when sending a direct message
export interface SendDirectMessagePayload {
  type: "direct_message";
  receiverId: string;
  content: string;
}

// Payload broadcasted/sent back to the recipient and sender
export interface DirectMessageEvent {
  type: "direct_message";
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string; // ISO format string
}
