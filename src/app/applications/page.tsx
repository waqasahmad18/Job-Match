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
  const [loading, setLoading] = useState(false);

  async function load(selectedDate: string) {
    setLoading(true);
    const data = await fetch(`/api/applications?status=sent,ready&date=${selectedDate}`).then((res) => res.json());
    setApplications(data.applications || []);
    setLoading(false);
  }

  useEffect(() => {
    load(date).catch(() => setLoading(false));
  }, [date]);

  const sentCount = applications.filter((item) => item.status === "sent").length;
  const uniqueCompanies = useMemo(
    () => new Set(applications.map((item) => item.companyName || item.job?.company).filter(Boolean)).size,
    [applications],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold">Sent CVs & email drafts</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Har company ko jo mail CV ke sath gayi, uska poora draft yahan hai — subject, hiring email, aur body.
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

      <div className="space-y-4">
        {applications.map((item) => (
          <article key={item._id} className="panel space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  {item.status === "sent" ? "Sent with CV" : "Draft ready"}
                </p>
                <h3 className="mt-1 text-xl font-semibold">
                  {item.companyName || item.job?.company || "Company"}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.jobTitle || item.job?.title || "Role"} · {formatDate(item.createdAt)}
                  {item.score != null ? ` · Score ${item.score}` : ""}
                </p>
              </div>
              <span className={`capitalize ${statusTone(item.status)}`}>{item.status}</span>
            </div>
            <div className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 text-sm">
              <p>
                <span className="text-[var(--muted)]">To: </span>
                <span className="text-[var(--accent-2)]">{item.emailTo || "No hiring email stored"}</span>
              </p>
              <p>
                <span className="text-[var(--muted)]">Subject: </span>
                {item.emailSubject || "—"}
              </p>
              <p>
                <span className="text-[var(--muted)]">CV: </span>
                {item.cvName || "Waqas Rafique Full Stack CV"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Email sent with the CV</p>
              {item.emailBody ? (
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-4 text-sm leading-7">
                  {item.emailBody}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">Is application ke liye draft save nahi hua.</p>
              )}
            </div>
          </article>
        ))}
        {!applications.length && !loading ? (
          <div className="panel p-8 text-sm text-[var(--muted)]">Is date pe koi sent CV ya draft nahi mila.</div>
        ) : null}
      </div>
    </div>
  );
}
