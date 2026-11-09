import { useState } from "react";
import { useAuth } from "./useAuth";

export function useTwoFactor() {
  const { validateTwoFactor, cancelTwoFactor } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // true only when the code is valid and the user is connected
  async function submit(code: string) {
    setLoading(true);
    setError(null);

    const result = await validateTwoFactor(code);
    setLoading(false);

    if (result.status === "success") return true;
    setError(result.status === "error" ? result.message : "Invalid code.");
    return false;
  }
  return { submit, cancel: cancelTwoFactor, loading, error };
}
