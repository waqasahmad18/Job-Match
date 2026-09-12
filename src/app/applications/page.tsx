"use client";

import { formatDate, statusTone } from "@/lib/format";
import type { SerializedApplication } from "@/types";
import { useEffect, useState } from "react";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<SerializedApplication[]>([]);
  const [selected, setSelected] = useState<SerializedApplication | null>(null);

  useEffect(() => {
    fetch("/api/applications")
      .then((res) => res.json())
      .then((data) => setApplications(data.applications || []));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold">Applications</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Every decision is logged: sent, ready, skipped, rejected, duplicate, or failed.
        </p>
      </header>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Job</th>
              <th className="px-5 py-3 font-medium">CV</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((item) => (
              <tr key={item._id} className="border-t border-[var(--line)]">
                <td className="px-5 py-3">
                  <button className="text-left" onClick={() => setSelected(item)}>
                    <div className="font-medium">{item.job?.title || "Job"}</div>
                    <div className="text-[var(--muted)]">{item.job?.company}</div>
                  </button>
                </td>
                <td className="px-5 py-3">{item.cvName || "—"}</td>
                <td className="px-5 py-3">{item.score ?? "—"}</td>
                <td className={`px-5 py-3 capitalize ${statusTone(item.status)}`}>{item.status}</td>
                <td className="px-5 py-3 text-[var(--muted)]">{formatDate(item.createdAt)}</td>
              </tr>
            ))}
            {!applications.length ? (
              <tr>
                <td className="px-5 py-8 text-[var(--muted)]" colSpan={5}>
                  Application history will appear after the first pipeline run.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <article className="panel p-5">
          <h3 className="text-xl font-semibold">{selected.emailSubject || selected.job?.title}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{selected.reason}</p>
          {selected.emailBody ? (
            <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{selected.emailBody}</pre>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
