import React, { useState } from "react";
import { ErrorAlert } from "../ui/ErrorAlert";
import { useLogin } from "../../hooks/auth/useLogin";
import { useNavigate } from "react-router-dom";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, loading, error } = useLogin();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    const success = await submit({ email, password });
    if (success) navigate("/home");
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-col gap-3">
        <label className="floating-label w-full flex-col">
          <span>Email</span>
          <input
            type="email"
            placeholder="Email"
            required
            className="input input-md validator w-full"
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="validator-hint">Enter a valid email address</p>
        </label>
        <label className="floating-label w-full flex-col">
          <span>Password</span>
          <input
            type="password"
            placeholder="Password"
            required
            className="input input-md validator w-full"
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="validator-hint">Enter your password</p>
        </label>
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={loading}
          className="btn flex-1 btn-accent"
        >
          {loading && (
            <span className="loading loading-spinner loading-xs"></span>
          )}
          Sign-in
        </button>
      </div>
    </form>
  );
}
