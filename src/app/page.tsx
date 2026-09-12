"use client";

import { StatCard } from "@/components/StatCard";
import { formatDate, statusTone } from "@/lib/format";
import type { DashboardStats, SerializedApplication, UserSettings } from "@/types";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [applications, setApplications] = useState<SerializedApplication[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [statsRes, settingsRes, appsRes] = await Promise.all([
      fetch("/api/stats").then((res) => res.json()),
      fetch("/api/settings").then((res) => res.json()),
      fetch("/api/applications").then((res) => res.json()),
    ]);
    setStats(statsRes);
    setSettings(settingsRes.settings);
    setApplications(appsRes.applications || []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Could not load dashboard data."));
  }, []);

  async function runPipeline() {
    setRunning(true);
    setMessage("Collecting jobs and scoring descriptions...");
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingest: true, limit: 80 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Pipeline failed.");
      } else {
        setMessage(
          `Processed ${data.processed} jobs. Sent today ${data.sentToday ?? 0}/${data.dailyTarget ?? 20} (Lahore ${data.lahoreToday ?? 0}). SMTP ${data.smtpReady ? "on" : "off"}.`,
        );
        await load();
      }
    } catch {
      setMessage("Pipeline request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">Today</p>
          <h2 className="text-3xl font-semibold">Matching overview</h2>
        </div>
        <button
          onClick={runPipeline}
          disabled={running}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1b1406] disabled:opacity-60"
        >
          {running ? "Running..." : "Collect & match jobs"}
        </button>
      </header>

      {stats && !stats.mongoConnected ? (
        <div className="panel border-[var(--accent)] p-4 text-sm">
          MongoDB is not connected yet. Copy `.env.example` to `.env.local`, set `MONGODB_URI`, then restart the app.
        </div>
      ) : null}

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Jobs found today" value={stats?.jobsToday ?? "—"} />
        <StatCard
          label="Relevant jobs"
          value={stats?.relevantJobs ?? "—"}
          hint={`${stats?.relevantWaitingEmail ?? 0} had no hiring email, so a CV could not go`}
        />
        <StatCard
          label="CVs sent today"
          value={`${stats?.sentToday ?? 0}/${stats?.dailyTarget ?? 20}`}
          hint={`Target 20 companies. All-time sent: ${stats?.applicationsSent ?? 0}`}
        />
        <StatCard
          label="Lahore sent today"
          value={`${stats?.lahoreToday ?? 0}/${stats?.lahoreTarget ?? "5-10"}`}
          hint="Lahore onsite + Lahore remote"
        />
        <StatCard label="Ignored / rejected" value={stats?.ignoredRejected ?? "—"} />
        <StatCard label="Match threshold" value={`${stats?.matchThreshold ?? settings?.matchThreshold ?? 80}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <h3 className="text-lg font-semibold">Apply rules</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Daily must-send: 5–10 Lahore full-stack CVs and 20 companies total (Lahore onsite, Lahore remote,
            worldwide remote). Vercel runs at 8:00 AM Pakistan time. Indeed/Glassdoor login walls are not scraped.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(settings?.locations || ["Remote worldwide", "Remote Pakistan", "Onsite Lahore only"]).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
            {(settings?.excludedCompanies || ["Interact Global"]).map((item) => (
              <span key={item} className="chip">Skip {item}</span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(settings?.roles || []).slice(0, 8).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </article>
        <article className="panel p-5">
          <h3 className="text-lg font-semibold">Excluded technologies</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Primary WordPress/Shopify work is rejected. Incidental mentions are not enough.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(settings?.excludedTechnologies || []).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </article>
      </section>

      <article className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-lg font-semibold">Recent applications</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Job</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Email / draft</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 8).map((item) => (
                <tr key={item._id} className="border-t border-[var(--line)]">
                  <td className="px-5 py-3">
                    <div className="font-medium">{item.job?.title || "Job"}</div>
                    <div className="text-[var(--muted)]">{item.job?.company}</div>
                  </td>
                  <td className="px-5 py-3">{item.score ?? "—"}</td>
                  <td className={`px-5 py-3 capitalize ${statusTone(item.status)}`}>{item.status}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">
                    <div>{item.emailTo || "—"}</div>
                    <div className="max-w-xs truncate">{item.emailSubject || item.reason || ""}</div>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
              {!applications.length ? (
                <tr>
                  <td className="px-5 py-8 text-[var(--muted)]" colSpan={5}>
                    No applications yet. The daily watcher will collect Lahore software-house jobs automatically.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
