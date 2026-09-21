export type UUID = string;
export type ISODateString = string;

export interface User {
  id: UUID;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: ISODateString;
}

export type PublicUser = Omit<User, 'email'>;

export type OnlineStatus = 'online' | 'offline' | 'in_game';

export interface Friendship {
  id: UUID;
  userId: UUID;
  friendId: UUID;
  status: 'pending' | 'accepted';
  createdAt: ISODateString;
}

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
