import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/auth/useAuth";
import { ErrorAlert } from "../ui/ErrorAlert";

const FALLBACK_ERROR = "Something went wrong, try again.";

// Allow authenticated users to permanently delete their account and associated data
export function DeleteAccountSettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const has2FA = user?.twoFactorSecretEnabled ?? false;

  const confirmDialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openModal() {
    setPassword("");
    setCode("");
    setError(null);
    confirmDialog.current?.showModal();
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (has2FA && code.length !== 6) {
      setError("Please enter your 6-digit 2FA code.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(has2FA ? { code } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? data?.message ?? FALLBACK_ERROR);
      }

      confirmDialog.current?.close();
      // Clear local auth context state and redirect to public home page
      await logout();
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card border border-error/40 bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-error">Delete account</h2>
        <p className="opacity-80">
          Permanently delete your account, friends list, and direct messages.
          This action cannot be undone.
        </p>

        <div className="card-actions justify-end pt-2">
          <button
            type="button"
            className="btn btn-error btn-outline"
            onClick={openModal}
          >
            Delete account
          </button>
        </div>
      </div>

      {/* Confirmation modal requiring password (and 2FA code if enabled) */}
      <dialog ref={confirmDialog} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold text-error">Delete your account?</h3>
          <p className="mt-2 text-sm opacity-80">
            All your account data, friendships, and direct messages will be
            permanently erased. Enter your password to confirm.
          </p>

          <form onSubmit={handleDelete} className="mt-4 flex flex-col gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Password</legend>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input validator w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="validator-hint">Enter your current password</p>
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

            {error && <ErrorAlert message={error} />}

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => confirmDialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-error"
                disabled={
                  busy || password === "" || (has2FA && code.length !== 6)
                }
              >
                {busy && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Permanently delete
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
