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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { username?: string; password?: string };
      setUsername(parsed.username || "");
      setPassword(parsed.password || "");
      setRememberPassword(true);
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6">
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
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="Username"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Password
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 pr-16"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={rememberPassword ? "current-password" : "off"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] hover:text-white"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={rememberPassword}
            onChange={(e) => setRememberPassword(e.target.checked)}
          />
          Remember password
        </label>
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
