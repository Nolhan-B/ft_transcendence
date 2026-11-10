import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTwoFactor } from "../../hooks/auth/useTwoFactor";

// Second step of the sign-in: the 6-digit code of the authenticator app.
// Shown on the sign-in card once the credentials have been accepted.
export function TwoFactorForm() {
  const [code, setCode] = useState("");
  const { submit, cancel, loading, error } = useTwoFactor();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    const success = await submit(code);
    if (success) navigate("/home");
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-center text-lg font-bold">Two-factor code</h2>
      <p className="text-center text-sm">
        Enter the 6-digit code shown by your authenticator app.
      </p>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        pattern="[0-9]{6}"
        placeholder="000000"
        aria-label="Two-factor code"
        className="input input-md w-full text-center tracking-[0.5em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="btn btn-neutral"
        >
          {loading && (
            <span className="loading loading-spinner loading-xs"></span>
          )}
          Verify
        </button>
        <button type="button" className="btn btn-ghost" onClick={cancel}>
          Back
        </button>
      </div>
    </form>
  );
}
