import { useState } from "react";
import { ErrorAlert } from "../ui/ErrorAlert";
import { useRegister } from "../../hooks/auth/useRegister";
import { useNavigate } from "react-router-dom";

export function RegisterForm() {
  const { submit, loading, error } = useRegister();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  function isValidEmail(email: string): boolean {
    // source : https://shramko.dev/snippets/is-email-valid-regex
    const MAX_EMAIL_LENGTH = 254;
    const isInvalidInput =
      !email || email.length === 0 || email.length > MAX_EMAIL_LENGTH;

    if (isInvalidInput) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    if (password != passwordConfirmation) {
      setFormError("Passwords not matching.");
      return;
    }
    if (username.length < 3) {
      setFormError("Username must be at least 3 characters long.");
      return;
    }
    if (username.length > 20) {
      setFormError("Username must be at most 20 characters long.");
      return;
    }
    if (!isValidEmail(email)) {
      setFormError("Invalid email format.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }
    setFormError(null);
    const status = await submit({ email, username, password });
    if (status) navigate("/home");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {(error || formError) && (
        <ErrorAlert message={error ? error : (formError ?? "")} />
      )}
      <div className="flex flex-col gap-3">
        <label className="floating-label">
          <span>Username</span>
          <input
            type="text"
            placeholder="Username"
            className="input input-md flex-1"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="floating-label">
          <span>Email</span>
          <input
            type="email"
            placeholder="Email"
            className="input input-md flex-1"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="floating-label">
          <span>Password</span>
          <input
            type="password"
            placeholder="Password"
            className="input input-md flex-1"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="floating-label">
          <span>Password confirmation</span>
          <input
            type="password"
            placeholder="Password confirmation"
            className="input input-md flex-1"
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />
        </label>
      </div>
      <button type="submit" disabled={loading} className="btn btn-neutral">
        {loading && (
          <span className="loading loading-spinner loading-xs"></span>
        )}
        Sign-up
      </button>
    </form>
  );
}
