import { useState, type FormEvent } from "react";
import { api } from "../api";
import UnoCard from "../components/UnoCard";
import type { Card, User } from "../types";

interface Props {
  onAuth: (token: string, user: User) => void;
}

const FLOATING: Card[] = [
  { id: "f1", color: "red", value: "7" },
  { id: "f2", color: "blue", value: "reverse" },
  { id: "f3", color: "wild", value: "wild_draw4" },
  { id: "f4", color: "green", value: "skip" },
  { id: "f5", color: "yellow", value: "draw2" },
  { id: "f6", color: "wild", value: "wild" },
];

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let token: string | null;
      let user: User | null;
      if (mode === "signup") {
        const res = await api.signup(email, username, password);
        token = res.token;
        user = res.user;
      } else {
        const res = await api.login(email, password);
        token = res.token;
        user = res.user;
        if (!token) throw new Error("2FA is enabled on this account (not supported in this UI yet)");
      }
      if (!user || !user.username) user = await api.me(token);
      onAuth(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="floating-cards" aria-hidden>
        {FLOATING.map((c, i) => (
          <UnoCard
            key={c.id}
            card={c}
            size="lg"
            className="float-card"
            style={{
              left: `${8 + i * 15}%`,
              animationDelay: `${i * -1.3}s`,
              animationDuration: `${7 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="auth-box panel">
        <div className="logo big">UNO</div>
        <p className="tagline">Gather your friends. Ruin friendships.</p>

        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Log in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {mode === "signup" && (
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={20}
                required
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn primary big" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Let's play" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
