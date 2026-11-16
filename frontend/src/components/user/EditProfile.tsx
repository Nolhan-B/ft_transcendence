import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Profile } from "shared";
import { useAuth } from "../../hooks/auth/useAuth";

const FALLBACK_ERROR = "Unable to save the profile.";

// The servers answer { error } or { message } depending on who rejects
async function errorOf(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error ?? data?.message ?? FALLBACK_ERROR;
}

interface Props {
  profile: Profile;
  onSaved: () => void;
}

// Button + modal to change my username and my avatar
export function EditProfile({ profile, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { refresh } = useAuth();
  const [username, setUsername] = useState(profile.username);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function open() {
    setUsername(profile.username);
    setFile(null);
    setError(null);
    dialogRef.current?.showModal();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (username !== profile.username) {
        const response = await fetch("/api/user/profile", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        if (!response.ok) throw new Error(await errorOf(response));
      }

      if (file) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/user/profile/avatar", {
          method: "PUT",
          credentials: "include",
          body,
        });
        if (!response.ok) throw new Error(await errorOf(response));
      }

      await refresh();
      onSaved();
      dialogRef.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={open}>
        Edit profile
      </button>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">Edit profile</h3>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Username</legend>
              <input
                type="text"
                className="input w-full"
                value={username}
                minLength={3}
                maxLength={20}
                required
                onChange={(event) => setUsername(event.target.value)}
              />
              <p className="label">3 to 20 characters</p>
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Avatar</legend>
              <input
                type="file"
                className="file-input w-full"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="label">PNG, JPG or WebP</p>
            </fieldset>

            {error && (
              <div role="alert" className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving && <span className="loading loading-spinner" />}
                Save
              </button>
            </div>
          </form>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
