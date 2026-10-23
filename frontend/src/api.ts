import type { GameMode, RoomInfo, User } from "./types";

const API_BASE = "/api";

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const d = data as { error?: string; message?: string } | null;
    throw new Error(d?.error ?? d?.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

function normalizeUser(raw: unknown): User {
  const r = raw as { user?: User } & User;
  const u = r.user ?? r;
  return { id: u.id, username: u.username, email: u.email };
}

export const api = {
  async signup(email: string, username: string, password: string) {
    const res = await request<{ token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
    return { token: res.token, user: res.user ? normalizeUser(res.user) : null };
  },

  async login(email: string, password: string) {
    const res = await request<{ token?: string; user?: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return {
      token: res.token ?? null,
      user: res.user ? normalizeUser(res.user) : null,
      raw: res as Record<string, unknown>,
    };
  },

  async me(token: string) {
    return normalizeUser(await request<unknown>("/auth/me", {}, token));
  },

  listRooms(token: string) {
    return request<RoomInfo[]>("/game/games/rooms", {}, token);
  },

  createRoom(
    token: string,
    body: { name: string; mode: GameMode; maxPlayers: number; password?: string },
  ) {
    return request<{ roomCode: string }>(
      "/game/games/rooms",
      { method: "POST", body: JSON.stringify(body) },
      token,
    );
  },
};
