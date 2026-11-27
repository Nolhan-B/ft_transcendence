import { useState } from "react";
import type { LoginPayload } from "shared";
import { useAuth } from "./useAuth";

export function useLogin() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // true only when the user is really connected (not while the 2FA code is pending)
  async function submit(payload: LoginPayload) {
    setLoading(true);
    setError(null);

    const result = await login(payload);
    setLoading(false);

    if (result.status === "success") return true;
    // "two-factor": no error, the card switches to the code form by itself
    if (result.status === "error") setError(result.message);
    return false;
  }
  return { submit, loading, error };
}
