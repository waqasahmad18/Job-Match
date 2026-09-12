"use client";

import { formatDate, statusTone } from "@/lib/format";
import type { SerializedApplication } from "@/types";
import { useEffect, useMemo, useState } from "react";

function todayPakistan() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

export default function ApplicationsPage() {
  const [date, setDate] = useState(todayPakistan());
  const [applications, setApplications] = useState<SerializedApplication[]>([]);
  const [selected, setSelected] = useState<SerializedApplication | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(selectedDate: string) {
    setLoading(true);
    const data = await fetch(`/api/applications?status=sent&date=${selectedDate}`).then((res) => res.json());
    setApplications(data.applications || []);
    setSelected(null);
    setLoading(false);
  }

  useEffect(() => {
    load(date).catch(() => setLoading(false));
  }, [date]);

  const sentCount = applications.length;
  const uniqueCompanies = useMemo(
    () => new Set(applications.map((item) => item.companyName || item.job?.company).filter(Boolean)).size,
    [applications],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold">Sent CVs</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Company name, hiring email, and the draft that was sent. Pick a date to review that day.
        </p>
      </header>

      <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
        <label className="grid gap-2 text-sm">
          Calendar date
          <input
            type="date"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2"
            value={date}
            max={todayPakistan()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-[var(--muted)]">CVs sent</p>
            <p className="text-2xl font-semibold">{loading ? "—" : sentCount}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Companies</p>
            <p className="text-2xl font-semibold">{loading ? "—" : uniqueCompanies}</p>
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Email sent to</th>
              <th className="px-5 py-3 font-medium">CV</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((item) => (
              <tr key={item._id} className="border-t border-[var(--line)]">
                <td className="px-5 py-3">
                  <button className="text-left font-medium" onClick={() => setSelected(item)}>
                    {item.companyName || item.job?.company || "Company"}
                  </button>
                </td>
                <td className="px-5 py-3">{item.jobTitle || item.job?.title || "—"}</td>
                <td className="px-5 py-3 text-[var(--accent-2)]">{item.emailTo || "—"}</td>
                <td className="px-5 py-3">{item.cvName || "Master CV"}</td>
                <td className={`px-5 py-3 ${statusTone("sent")}`}>{item.score ?? "—"}</td>
                <td className="px-5 py-3 text-[var(--muted)]">{formatDate(item.createdAt)}</td>
              </tr>
            ))}
            {!applications.length && !loading ? (
              <tr>
                <td className="px-5 py-8 text-[var(--muted)]" colSpan={6}>
                  No CVs were sent on this date.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <article className="panel p-5">
          <h3 className="text-xl font-semibold">{selected.companyName || selected.job?.company}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selected.jobTitle || selected.job?.title} · {selected.emailTo || "No email stored"}
          </p>
          {selected.emailSubject ? <p className="mt-3 text-sm font-medium">{selected.emailSubject}</p> : null}
          {selected.emailBody ? (
            <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{selected.emailBody}</pre>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
