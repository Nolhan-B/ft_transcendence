import { GameMode, GameSettings } from "shared";

export interface Room {
  code: string;
  name: string;
  password?: string;
  leaderId: string;
  maxPlayers: number;
  players: { id: string; username: string }[];
  mode: GameMode;
  settings: GameSettings;
  createdAt: Date;
  // Joueurs invites par un membre : ils entrent sans le mot de passe
  invited: Set<string>;
}

// Une room n'a jamais plus d'invites que ca (un membre qui spamme)
const MAX_INVITED = 50;

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(
    leaderId: string,
    username: string,
    mode: GameMode,
    maxPlayers: number,
    name?: string,
    password?: string,
  ): string {
    let roomCode: string;

    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const defaultSettings: GameSettings = {
      stacking: "none",
      sevenZeroRule: false,
      jumpIn: false,
      bluffChallenge: false,
      unoCallout: false,
    };

    const room: Room = {
      code: roomCode,
      name: name ?? `${username}'s room`,
      password: password,
      leaderId: leaderId,
      maxPlayers: maxPlayers,
      players: [{ id: leaderId, username: username }],
      mode: mode,
      settings: defaultSettings,
      createdAt: new Date(),
      invited: new Set(),
    };

    this.rooms.set(roomCode, room);

    return roomCode;
  }

  leaveRoom(code: string, userId: string): void {
    const room = this.getRoom(code);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== userId);

    const humans = room.players.filter((p) => !p.id.startsWith("bot_"));
    if (humans.length === 0) {
      this.removeRoom(code);
      return;
    }

    if (room.leaderId === userId) room.leaderId = humans[0].id;
  }

  joinRoom(
    code: string,
    userId: string,
    username: string,
    password?: string,
  ): { ok: true; room: Room } | { ok: false; error: string } {
    const room = this.getRoom(code);
    if (!room)
      return { ok: false, error: `Can not find room with code ${code}` };

    if (room.players.some((p) => p.id === userId))
      return { ok: false, error: "Already in room" };

    if (room.maxPlayers === room.players.length)
      return {
        ok: false,
        error: "Max player capacity has already been reached for this room",
      };

    if (room.password && !room.invited.has(userId)) {
      if (room.password !== password)
        return { ok: false, error: "Password is incorrect" };
    }

    room.players.push({ id: userId, username: username });

    return { ok: true, room: room };
  }

  updateSettings(code: string, leaderId: string, settings: GameSettings): void {
    const room = this.getRoom(code);
    if (!room) return;

    if (leaderId !== room.leaderId) return;

    room.settings = settings;
  }

  // Un membre de la room invite un joueur : il pourra entrer sans le mot de
  // passe (le membre le connait, il pourrait aussi bien le lui donner)
  invite(
    code: string,
    memberId: string,
    userId: string,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: "Room not found" };
    if (!room.players.some((p) => p.id === memberId))
      return { ok: false, error: "You are not in this room" };
    if (room.invited.size >= MAX_INVITED && !room.invited.has(userId))
      return { ok: false, error: "Too many invites for this room" };
    room.invited.add(userId);
    return { ok: true };
  }

  listRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
  }
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
