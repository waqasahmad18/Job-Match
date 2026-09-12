"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/cvs", label: "CV Versions" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const nav = (
    <nav className="flex flex-col gap-2">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`min-h-11 rounded-xl px-4 py-3 text-sm ${
              active
                ? "bg-[var(--accent)] text-[#1b1406]"
                : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_94%,transparent)] px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">Job Match</p>
          <p className="truncate text-base font-semibold">Automation Desk</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-2)]"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </header>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,280px)] flex-col border-r border-[var(--line)] bg-[var(--panel)] p-4 transition-transform lg:static lg:w-auto lg:translate-x-0 lg:bg-[color-mix(in_srgb,var(--panel)_88%,transparent)] ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="hidden px-1 pb-5 lg:block">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">Job Match</p>
          <h1 className="mt-1 text-xl font-semibold">Automation Desk</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Score the description, not just the title.</p>
        </div>
        {nav}
        <div className="mt-auto pt-6">
          <button onClick={logout} className="min-h-11 text-sm text-[var(--muted)] hover:text-white">
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
