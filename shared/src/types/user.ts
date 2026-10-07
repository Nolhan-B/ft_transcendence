export type UUID = string;
export type ISODateString = string;

export interface User {
  id: UUID;
  email: string;
  username: string;
  avatarUrl: string | null;
  twoFactorSecret: string | null;
  twoFactorSecretEnabled: boolean;
  createdAt: ISODateString;
}

export type Profile = Omit<
  User,
  'email' | 'twoFactorSecret' | 'twoFactorSecretEnabled'
>;

export type PublicUser = Omit<User, 'email'>;

export type OnlineStatus = 'online' | 'offline' | 'in_game';

export interface Friendship {
  id: UUID;
  userId: UUID;
  friendId: UUID;
  status: FriendshipStatus;
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

export interface TempTokenPayload {
  id: string;
  requires2FA: true;
}

export interface JwtPayload {
  id: string;
  email: string;
}

export interface UpdateProfilePayload {
  username?: string;
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

export interface TwoFactorValidatePayload {
  tempToken: string;
  code: string;
}

export type AuthResponse =
  { token: string; user: User } | TwoFactorRequiredResponse;

export interface TwoFactorVerifyPayload {
  code: string;
}

export interface TwoFactorDisablePayload {
  password: string;
  code: string;
}

export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

export type FriendshipWithFriend = {
  friend: {
    id: string;
    username: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
};

export type FriendshipWithUser = {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
};
