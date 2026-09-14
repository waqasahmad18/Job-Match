"use client";

import { StatCard } from "@/components/StatCard";
import { formatCompanyWithPlace, formatDate, statusTone } from "@/lib/format";
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
        body: JSON.stringify({ ingest: true, limit: 25, sendBatch: 12 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Pipeline failed.");
      } else if (data.skipped) {
        setMessage(data.skipped);
        await load();
      } else {
        setMessage(
          `Fetched ${data.ingestedKept ?? 0} allowed jobs (${data.ingestedNew ?? 0} new, dropped ${data.ingestedDropped ?? 0} off-location). Processed ${data.processed} jobs. Sent today ${data.sentToday ?? 0}/${data.dailyTarget ?? 50} (Lahore ${data.lahoreToday ?? 0}/${data.lahoreTarget ?? 25}, remote ${data.remoteToday ?? 0}/${data.remoteTarget ?? 25}). SMTP ${data.smtpReady ? "on" : "off"}.`,
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
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">Today</p>
          <h2 className="text-2xl font-semibold sm:text-3xl">Matching overview</h2>
        </div>
        <button
          onClick={runPipeline}
          disabled={running}
          className="min-h-11 w-full rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1b1406] disabled:opacity-60 sm:w-auto"
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <StatCard
          label="Jobs found today"
          value={stats?.jobsToday ?? "—"}
          hint={stats?.jobsWaiting ? `${stats.jobsWaiting} still waiting to be scored` : "All collected jobs have been scored"}
        />
        <StatCard
          label="Relevant today"
          value={stats?.relevantJobs ?? "—"}
          hint={`${stats?.relevantWaitingEmail ?? 0} had no hiring email today`}
        />
        <StatCard
          label="CVs sent today"
          value={`${stats?.sentToday ?? 0}/${stats?.dailyTarget ?? 50}`}
          hint={`25 Lahore + 25 worldwide remote. All-time sent: ${stats?.applicationsSent ?? 0}`}
        />
        <StatCard
          label="Lahore sent today"
          value={`${stats?.lahoreToday ?? 0}/${stats?.lahoreTarget ?? 25}`}
          hint="Lahore onsite + Lahore remote"
        />
        <StatCard
          label="Worldwide remote today"
          value={`${stats?.remoteToday ?? 0}/${stats?.remoteTarget ?? 25}`}
          hint="Remote roles outside a city lock"
        />
        <StatCard label="Ignored / rejected" value={stats?.ignoredRejected ?? "—"} />
        <StatCard label="Match threshold" value={`${stats?.matchThreshold ?? settings?.matchThreshold ?? 75}%`} />
        <StatCard
          label="Last auto hunt"
          value={stats?.lastCronLabel ?? "Never"}
          hint={stats?.lastCronNote || "Next Vercel run is 8:00–8:59 AM Pakistan time"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <h3 className="text-lg font-semibold">Apply rules</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Daily target stays equal: 25 Lahore (onsite + Lahore remote) and 25 worldwide remote.
            Vercel hunts and sends every day in the 8:00 AM Pakistan hour. Extra waves can run later if GitHub Actions has CRON_SECRET.
            Gmail bounce replies mark invalid addresses, then a confirmed hiring email is used to resend.
            Indeed/Glassdoor login walls are not scraped.
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
        <div className="border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <h3 className="text-lg font-semibold">Recent applications</h3>
        </div>
        <div className="space-y-3 p-4 md:hidden">
          {applications.slice(0, 8).map((item) => (
            <div key={item._id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4">
              <p className="font-medium">{item.job?.title || "Job"}</p>
              <p className="text-sm text-[var(--muted)]">
                {item.companyName || formatCompanyWithPlace(item.job?.company, item.job?.location)}
              </p>
              <p className={`mt-2 text-sm capitalize ${statusTone(item.status)}`}>
                {item.status} · Score {item.score ?? "—"}
              </p>
              <p className="mt-1 break-all text-sm text-[var(--muted)]">{item.emailTo || item.reason || "—"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</p>
            </div>
          ))}
          {!applications.length ? (
            <p className="py-4 text-sm text-[var(--muted)]">No applications yet. Daily automation will send CVs automatically.</p>
          ) : null}
        </div>
        <div className="hidden overflow-x-auto md:block">
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
                    <div className="text-[var(--muted)]">
                      {item.companyName || formatCompanyWithPlace(item.job?.company, item.job?.location)}
                    </div>
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
                    No applications yet. Daily automation will send CVs automatically.
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
