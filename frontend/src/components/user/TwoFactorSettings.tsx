import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../hooks/auth/useAuth";
import { ErrorAlert } from "../ui/ErrorAlert";

const FALLBACK_ERROR = "Something went wrong, try again.";

async function post(url: string, body?: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? data?.message ?? FALLBACK_ERROR);
  }
  return response;
}

// Enable (QR code + first code) or disable (password + code) the 2FA
export function TwoFactorSettings() {
  const { user, refresh } = useAuth();
  const enabled = user?.twoFactorSecretEnabled ?? false;

  const enableDialog = useRef<HTMLDialogElement>(null);
  const disableDialog = useRef<HTMLDialogElement>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Error of the "Enable" button itself (the dialog is not open yet)
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCode("");
    setPassword("");
    setError(null);
    setStartError(null);
  }

  // Asks the server for a new secret: never done when the 2FA is already on,
  // it would replace the secret of the authenticator app.
  async function startEnable() {
    reset();
    setNotice(null);
    setBusy(true);
    try {
      const response = await post("/api/auth/2fa/enable");
      const data: { qrCode: string } = await response.json();
      setQrCode(data.qrCode);
      enableDialog.current?.showModal();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function startDisable() {
    reset();
    setNotice(null);
    disableDialog.current?.showModal();
  }

  async function submit(
    event: FormEvent,
    url: string,
    body: unknown,
    dialog: HTMLDialogElement | null,
    success: string,
  ) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(url, body);
      await refresh();
      dialog?.close();
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">6-digit code</legend>
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
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />
      <p className="validator-hint">Enter the 6 digits</p>
    </fieldset>
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          Two-factor authentication
          <span
            className={`badge ${enabled ? "badge-success" : "badge-ghost"}`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </h2>
        <p className="opacity-80">
          Ask for a code from an authenticator app (Google Authenticator,
          Authy...) in addition to your password when you sign in.
        </p>

        {notice && (
          <div role="alert" className="alert alert-success">
            <span>{notice}</span>
          </div>
        )}
        {startError && <ErrorAlert message={startError} />}

        <div className="card-actions justify-end">
          {enabled ? (
            <button
              type="button"
              className="btn btn-error btn-outline"
              onClick={startDisable}
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={startEnable}
            >
              {busy && <span className="loading loading-spinner loading-xs" />}
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Enable: scan the QR code, then prove it works with a first code */}
      <dialog ref={enableDialog} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">
            Enable two-factor authentication
          </h3>

          <ul className="steps steps-vertical mt-4">
            <li className="step step-primary">
              Scan the QR code with your authenticator app
            </li>
            <li className="step step-primary">
              Enter the code the app shows to confirm
            </li>
          </ul>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) =>
              submit(
                event,
                "/api/auth/2fa/verify",
                { code },
                enableDialog.current,
                "Two-factor authentication is now enabled.",
              )
            }
          >
            {qrCode && (
              // The QR code needs a white background to be scanned
              <img
                src={qrCode}
                alt="Two-factor authentication QR code"
                className="mx-auto h-52 w-52 rounded-box bg-white p-2"
              />
            )}

            {codeInput}

            {error && <ErrorAlert message={error} />}

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => enableDialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || code.length !== 6}
              >
                {busy && <span className="loading loading-spinner" />}
                Verify and enable
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Disable: the password and a current code are both needed */}
      <dialog ref={disableDialog} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">
            Disable two-factor authentication
          </h3>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) =>
              submit(
                event,
                "/api/auth/2fa/disable",
                { password, code },
                disableDialog.current,
                "Two-factor authentication is now disabled.",
              )
            }
          >
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Password</legend>
              <input
                type="password"
                required
                className="input validator w-full"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="validator-hint">Enter your password</p>
            </fieldset>

            {codeInput}

            {error && <ErrorAlert message={error} />}

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => disableDialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-error"
                disabled={busy || code.length !== 6 || password === ""}
              >
                {busy && <span className="loading loading-spinner" />}
                Disable
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
