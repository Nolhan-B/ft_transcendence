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
}

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
    };

    this.rooms.set(roomCode, room);

    return roomCode;
  }

  leaveRoom(code: string, userId: string): void {
    const room = this.getRoom(code);
    if (!room) return;

    if (room.players.length === 1) {
      this.removeRoom(code);
      return;
    }

    room.players = room.players.filter((p) => p.id !== userId);

    if (room.leaderId === userId) room.leaderId = room.players[0].id;
  }

  updateSettings(code: string, leaderId: string, settings: GameSettings): void {
    const room = this.getRoom(code);
    if (!room) return;

    if (leaderId !== room.leaderId) return;

    room.settings = settings;
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
