import { createContext } from "react";
import type { LoginPayload, SignupPayload, User } from "shared";

// The server never sends the 2FA secret to the client
export type AuthUser = Omit<User, "twoFactorSecret">;

export type AuthResult =
  | { status: "success" }
  | { status: "two-factor" } // credentials ok, the 2FA code is still needed
  | { status: "error"; message: string };

export interface AuthContextValue {
  user: AuthUser | null;
  // true until the first answer of the server: avoids flashing the login page
  loading: boolean;
  // true between a login that needs the 2FA code and the code being validated
  twoFactorPending: boolean;
  login: (payload: LoginPayload) => Promise<AuthResult>;
  validateTwoFactor: (code: string) => Promise<AuthResult>;
  cancelTwoFactor: () => void;
  register: (payload: SignupPayload) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
