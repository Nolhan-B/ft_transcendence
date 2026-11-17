import { useState } from "react";
import { ErrorAlert } from "../ui/ErrorAlert";
import { useRegister } from "../../hooks/auth/useRegister";
import { Link, useNavigate } from "react-router-dom";

export function RegisterForm() {
  const { submit, loading, error } = useRegister();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Prevent default browser form submission
    if (password != passwordConfirmation) {
      setFormError("Passwords not matching.");
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
            required
            minLength={3}
            maxLength={20}
            className="input input-md validator flex-1"
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="validator-hint">3 to 20 characters</p>
        </label>
        <label className="floating-label">
          <span>Email</span>
          <input
            type="email"
            placeholder="Email"
            required
            maxLength={254}
            pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
            className="input input-md validator flex-1"
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="validator-hint">Enter a valid email address</p>
        </label>
        <label className="floating-label">
          <span>Password</span>
          <input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            className="input input-md validator flex-1"
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="validator-hint">At least 8 characters</p>
        </label>
        <label className="floating-label">
          <span>Password confirmation</span>
          <input
            type="password"
            placeholder="Password confirmation"
            required
            className="input input-md validator flex-1"
            onChange={(e) => setPasswordConfirmation(e.target.value)}
          />
          <p className="validator-hint">Confirm your password</p>
        </label>
      </div>
      <button type="submit" disabled={loading} className="btn btn-neutral">
        {loading && (
          <span className="loading loading-spinner loading-xs"></span>
        )}
        Sign-up
      </button>
      {/* Link legal policies directly from the sign-up flow */}
      <p className="text-center text-xs opacity-75">
        By creating an account, you agree to our{" "}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
