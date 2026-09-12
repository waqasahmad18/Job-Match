"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/cvs", label: "CV Versions" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-[var(--line)] lg:border-b-0 lg:border-r bg-[color-mix(in_srgb,var(--panel)_88%,transparent)]">
        <div className="px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">Job Match</p>
          <h1 className="mt-1 text-xl font-semibold">Automation Desk</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Score the description, not just the title.
          </p>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm ${
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
        <div className="px-4 pb-5">
          <button onClick={logout} className="text-sm text-[var(--muted)] hover:text-white">
            Log out
          </button>
        </div>
      </aside>
      <main className="px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
