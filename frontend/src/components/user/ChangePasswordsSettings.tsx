import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../hooks/auth/useAuth";
import { ErrorAlert } from "../ui/ErrorAlert";

const FALLBACK_ERROR = "Something went wrong, try again.";

export function ChangePasswordSettings() {
  const { user } = useAuth();
  const has2FA = user?.twoFactorSecretEnabled ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (has2FA && code.length !== 6) {
      setError("Please enter your 6-digit 2FA code.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          ...(has2FA ? { code } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? data?.message ?? FALLBACK_ERROR);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCode("");
      setNotice("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Change password</h2>
        <p className="opacity-80">
          Update your account password.
          {has2FA &&
            " Since two-factor authentication is enabled, a 6-digit code is also required."}
        </p>

        {notice && (
          <div role="alert" className="alert alert-success">
            <span>{notice}</span>
          </div>
        )}

        {error && <ErrorAlert message={error} />}

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Current password</legend>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input validator w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">New password</legend>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              className="input validator w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="validator-hint">At least 8 characters</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Confirm new password</legend>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              className="input validator w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </fieldset>

          {has2FA && (
            <fieldset className="fieldset">
              <legend className="fieldset-legend">6-digit 2FA code</legend>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                placeholder="000000"
                className="input validator w-full text-center tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <p className="validator-hint">Enter the 6 digits</p>
            </fieldset>
          )}

          <div className="card-actions justify-end pt-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || (has2FA && code.length !== 6)}
            >
              {busy && <span className="loading loading-spinner loading-xs" />}
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
