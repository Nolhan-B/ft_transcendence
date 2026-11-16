import type { DirectMessage } from "shared";

/** Id de l'utilisateur connecté (à remplacer par useAuth().user.id). */
export const MOCK_CURRENT_USER_ID = "user-1";

/** Liste de test : à boucler comme les messages renvoyés par l'API. */
export const MOCK_DIRECT_MESSAGES: DirectMessage[] = [
  {
    id: "dm-1",
    senderId: "user-2",
    receiverId: "user-1",
    content: "Salut, ça va ?",
    messageType: "text",
    gameRoomId: null,
    createdAt: "2026-11-12T10:00:00.000Z",
    delivered: true,
  },
  {
    id: "dm-2",
    senderId: "user-1",
    receiverId: "user-2",
    content: "Oui et toi ?",
    messageType: "text",
    gameRoomId: null,
    createdAt: "2026-11-12T10:01:00.000Z",
    delivered: true,
  },
  {
    id: "dm-3",
    senderId: "user-2",
    receiverId: "user-1",
    content: "On joue ?",
    messageType: "text",
    gameRoomId: "room-42",
    createdAt: "2026-11-12T10:02:00.000Z",
    delivered: true,
  },
  {
    id: "dm-4",
    senderId: "user-1",
    receiverId: "user-2",
    content: "Comment on fait ?",
    messageType: "text",
    gameRoomId: null,
    createdAt: "2026-11-12T10:03:00.000Z",
    delivered: true,
  },
  {
    id: "dm-5",
    senderId: "user-1",
    receiverId: "user-2",
    content: "Il faut creer un groupe c'est ca ?",
    messageType: "text",
    gameRoomId: null,
    createdAt: "2026-11-12T10:04:00.000Z",
    delivered: true,
  },
  {
    id: "dm-6",
    senderId: "user-2",
    receiverId: "user-1",
    content: "oui",
    messageType: "text",
    gameRoomId: "room-42",
    createdAt: "2026-11-12T10:05:00.000Z",
    delivered: true,
  },
  {
    id: "dm-7",
    senderId: "user-2",
    receiverId: "user-1",
    content: "Ajoute moi en ami",
    messageType: "text",
    gameRoomId: "room-42",
    createdAt: "2026-11-12T10:06:00.000Z",
    delivered: true,
  },
];
