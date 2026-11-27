import { useState } from "react";
import type { SignupPayload } from "shared";
import { useAuth } from "./useAuth";

export function useRegister() {
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: SignupPayload) {
    setLoading(true);
    setError(null);

    const result = await register(payload);
    setLoading(false);

    if (result.status === "success") return true;
    setError(result.status === "error" ? result.message : "Sign-up failed.");
    return false;
  }
  return { submit, loading, error };
}
