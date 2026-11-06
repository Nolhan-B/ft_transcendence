import { useState } from "react";
import type { LoginPayload } from "shared"

export function useLogin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(payload: LoginPayload) {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Wrong credentials.");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }
    return {submit, loading, error};
}