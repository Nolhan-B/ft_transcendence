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
