import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Profile } from "shared";
import type { DirectMessage, GameMode, GameStatus } from "shared";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";
import { useAuth } from "../../../hooks/auth/useAuth";
import { useChat } from "../../../hooks/ws/useChat";
import { useGame } from "../../../hooks/ws/useGame";

// Invites are for a classic room (ranked games only go through matchmaking)
const CLASSIC = "classic" as GameMode;
const IN_PROGRESS = "in_progress" as GameStatus;

export type FriendChatProps = {
  profile: Profile;
};

const scrollToBottom = (element: HTMLDivElement | null) => {
  if (element) element.scrollTop = element.scrollHeight;
};

export default function FriendChat({ profile }: FriendChatProps) {
  const { user } = useAuth();
  const { conversations, loadHistory, sendMessage, sendGameInvite, status } =
    useChat();
  const game = useGame();
  const navigate = useNavigate();
  // Set while the room made for this invite is being created: the invite
  // leaves once the server sent the room (and its code)
  const inviting = useRef(false);
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

  // Invite to play (not while I am playing: gameId stays set after a game,
  // the status of the game says if it still runs). In my current room if I have one, else a new room. Then
  // I go and wait there (that page change closes the friends drawer)
  function invite() {
    if (status !== "open" || game.status !== "open") return;
    if (game.room) {
      sendGameInvite(profile.id, game.room.code);
      navigate(`/play/rooms/${game.room.code}`);
      return;
    }
    inviting.current = true;
    game.createRoom({
      name: `${user?.username ?? "My"}'s room`,
      mode: CLASSIC,
      maxPlayers: 4,
    });
  }

  useEffect(() => {
    if (!inviting.current || !game.room) return;
    inviting.current = false;
    sendGameInvite(profile.id, game.room.code);
    navigate(`/play/rooms/${game.room.code}`);
  }, [game.room, profile.id, sendGameInvite, navigate]);

  // Join the room of an invite. The server lets a player sit in two rooms:
  // leave mine first. The lobby moves to the room once the server answers.
  function join(roomCode: string) {
    if (game.room?.code === roomCode) {
      navigate(`/play/rooms/${roomCode}`);
      return;
    }
    if (game.room) game.leaveRoom();
    game.joinRoom(roomCode);
    navigate("/play");
  }

  useEffect(() => {
    scrollToBottom(bottomRef.current);
  }, [chatHistory.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={bottomRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain"
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
            {isInvite(message) ? (
              <GameInviteCard
                roomCode={message.gameRoomId}
                mine={message.senderId !== profile.id}
                inMyRoom={game.room?.code === message.gameRoomId}
                onJoin={() => join(message.gameRoomId)}
              />
            ) : (
              <div className="chat-bubble text-sm">{message.content}</div>
            )}
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
        <button
          type="button"
          className="btn btn-square border-0 bg-primary text-primary-content"
          title={`Invite ${profile.username} to play`}
          aria-label={`Invite ${profile.username} to play`}
          disabled={
            status !== "open" ||
            game.status !== "open" ||
            game.gameState?.status === IN_PROGRESS
          }
          onClick={invite}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="11" height="15" rx="2" />
            <path d="M14 7.5l4.6 1.2a2 2 0 0 1 1.4 2.4l-2.3 8.7a2 2 0 0 1-2.4 1.4L13 20.6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function isInvite(
  message: DirectMessage,
): message is DirectMessage & { gameRoomId: string } {
  return message.messageType === "game_invite" && !!message.gameRoomId;
}

// A game invite in the chat: the room code, and a "Join" button for the
// friend who received it
function GameInviteCard({
  roomCode,
  mine,
  inMyRoom,
  onJoin,
}: {
  roomCode: string;
  mine: boolean;
  inMyRoom: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="chat-bubble flex flex-col items-center gap-2 border-2 border-primary/60 bg-base-300 p-3 text-center">
      <span className="text-xs font-bold tracking-wider uppercase opacity-70">
        {mine ? "You sent an invite" : "Game invite"}
      </span>
      <span className="text-display text-xl tracking-[0.15em] text-primary">
        #{roomCode}
      </span>
      {mine ? (
        <span className="text-xs opacity-60">Waiting in the room...</span>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onJoin}
        >
          {inMyRoom ? "Back to the room" : "Join"}
        </button>
      )}
    </div>
  );
}
