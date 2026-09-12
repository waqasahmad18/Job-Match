"use client";

import { formatDate, statusTone } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";

type JobRow = {
  _id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  sourceUrl: string;
  description: string;
  status: string;
  collectedAt: string;
  match?: {
    score: number;
    relevant: boolean;
    matchedSkills?: string[];
    reason?: string;
    rejected?: boolean;
  } | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState<JobRow | null>(null);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    company: "",
    sourceUrl: "",
    location: "Remote",
    description: "",
  });

  async function load() {
    const data = await fetch("/api/jobs").then((res) => res.json());
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Could not load jobs."));
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "relevant") return jobs.filter((job) => job.match?.relevant);
    return jobs.filter((job) => job.status === filter);
  }, [jobs, filter]);

  async function addJob(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not save job.");
      return;
    }
    setForm({ title: "", company: "", sourceUrl: "", location: "Remote", description: "" });
    setMessage("Job saved. Process it from the table.");
    await load();
  }

  async function processOne(id: string) {
    setMessage("Scoring job description...");
    const res = await fetch(`/api/jobs/${id}`, { method: "POST" });
    const data = await res.json();
    setMessage(`${data.status}: ${data.reason || ""}`);
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold">Jobs</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Manual jobs and RemoteOK software listings are stored, then scored from the description.
        </p>
      </header>

      <form className="panel grid gap-3 p-5 md:grid-cols-2" onSubmit={addJob}>
        <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
        <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <textarea className="min-h-28 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 md:col-span-2" placeholder="Full job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="md:col-span-2">
          <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#1b1406]">
            Add job
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {["all", "relevant", "new", "matched", "rejected", "sent"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`chip capitalize ${filter === item ? "bg-[var(--accent)] text-[#1b1406]" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Collected</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((job) => (
              <tr key={job._id} className="border-t border-[var(--line)]">
                <td className="px-5 py-3">
                  <button className="text-left" onClick={() => setSelected(job)}>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-[var(--muted)]">{job.company} · {job.location}</div>
                  </button>
                </td>
                <td className="px-5 py-3">{job.match?.score ?? "—"}</td>
                <td className={`px-5 py-3 capitalize ${statusTone(job.status)}`}>{job.status}</td>
                <td className="px-5 py-3 text-[var(--muted)]">{formatDate(job.collectedAt)}</td>
                <td className="px-5 py-3">
                  <button onClick={() => processOne(job._id)} className="text-[var(--accent-2)]">
                    Process
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td className="px-5 py-8 text-[var(--muted)]" colSpan={5}>
                  No jobs in this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <aside className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">{selected.title}</h3>
              <p className="text-sm text-[var(--muted)]">{selected.company} · {selected.source}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-[var(--muted)]">Close</button>
          </div>
          <p className="mt-3 text-sm">
            Score {selected.match?.score ?? "—"} · {(selected.match?.matchedSkills || []).join(", ") || "No skills scored yet"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">{selected.match?.reason}</p>
          <a className="mt-3 inline-block text-sm text-[var(--accent)]" href={selected.sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
          <p className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
            {selected.description}
          </p>
        </aside>
      ) : null}
    </div>
  );
}
