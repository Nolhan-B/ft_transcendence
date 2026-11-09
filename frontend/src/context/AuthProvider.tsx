import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LoginPayload, SignupPayload } from "shared";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue, AuthResult, AuthUser } from "./AuthContext";

function postJson(url: string, body?: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // the session lives in an httpOnly cookie
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function errorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return data?.error ?? fallback;
}

// Single source of truth for "who is connected". The token is in an httpOnly
// cookie, unreadable from JS: the only way to know the user is to ask the
// server (GET /api/auth/me).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Temporary token given by the server when the 2FA code is still needed
  const [tempToken, setTempToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      // Any non-ok answer (no cookie, expired token...) means not connected
      setUser(res.ok ? ((await res.json()).user as AuthUser) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthResult> => {
      try {
        const res = await postJson("/api/auth/login", payload);
        if (!res.ok) {
          return { status: "error", message: "Wrong credentials." };
        }
        const data = await res.json();
        if (data.requiresTwoFactor) {
          setTempToken(data.tempToken);
          return { status: "two-factor" };
        }
        await refresh();
        return { status: "success" };
      } catch {
        return { status: "error", message: "Server unreachable." };
      }
    },
    [refresh],
  );

  const validateTwoFactor = useCallback(
    async (code: string): Promise<AuthResult> => {
      if (!tempToken) {
        return { status: "error", message: "No login in progress." };
      }
      try {
        const res = await postJson("/api/auth/2fa/validate", {
          tempToken,
          code,
        });
        if (!res.ok) {
          return {
            status: "error",
            message: await errorMessage(res, "Invalid code."),
          };
        }
        setTempToken(null);
        await refresh();
        return { status: "success" };
      } catch {
        return { status: "error", message: "Server unreachable." };
      }
    },
    [tempToken, refresh],
  );

  const register = useCallback(
    async (payload: SignupPayload): Promise<AuthResult> => {
      try {
        const res = await postJson("/api/auth/signup", payload);
        if (!res.ok) {
          return {
            status: "error",
            message: await errorMessage(res, "Sign-up failed."),
          };
        }
        await refresh(); // the server connects the new user right away
        return { status: "success" };
      } catch {
        return { status: "error", message: "Server unreachable." };
      }
    },
    [refresh],
  );

  const cancelTwoFactor = useCallback(() => setTempToken(null), []);

  const logout = useCallback(async () => {
    try {
      await postJson("/api/auth/logout"); // the server clears the cookie
    } finally {
      setUser(null);
      setTempToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      twoFactorPending: tempToken !== null,
      login,
      validateTwoFactor,
      cancelTwoFactor,
      register,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      tempToken,
      login,
      validateTwoFactor,
      cancelTwoFactor,
      register,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
