"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const REMEMBER_KEY = "job-match-remember-login";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { username?: string; password?: string };
        setUsername(parsed.username || "");
        setPassword(parsed.password || "");
        setRememberPassword(true);
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
    setReady(true);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      if (rememberPassword) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-md space-y-4 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">Job Match</p>
          <h1 className="mt-2 text-2xl font-semibold">Private login</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Loading login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6" autoComplete="on">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">Job Match</p>
          <h1 className="mt-2 text-2xl font-semibold">Private login</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This tool is only for Waqas Rafique. Enter your account to continue.
          </p>
        </div>
        <label className="grid gap-2 text-sm">
          Username
          <input
            name="username"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Username"
          />
        </label>
        <div className="grid gap-2 text-sm">
          <label htmlFor="login-password">Password</label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--accent)] hover:bg-[var(--panel)]"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.4 5.1A10.8 10.8 0 0 1 12 4.8c5.2 0 9.3 3.4 10.5 7.2a11.4 11.4 0 0 1-4.1 5.1" />
                  <path d="M6.6 6.6A11.4 11.4 0 0 0 1.5 12C2.7 15.8 6.8 19.2 12 19.2c1.4 0 2.7-.2 3.9-.7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <label className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            Save password on this computer
          </label>
        </div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          disabled={loading}
          className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#1b1406] disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
