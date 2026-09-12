"use client";

import type { SerializedCv } from "@/types";
import { useEffect, useState } from "react";

export default function CvsPage() {
  const [cvs, setCvs] = useState<SerializedCv[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    focus: "fullstack",
    isDefault: false,
  });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const data = await fetch("/api/cvs").then((res) => res.json());
    setCvs(data.cvs || []);
  }

  useEffect(() => {
    load().catch(() => setMessage("Could not load CVs."));
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a CV file first.");
      return;
    }
    const payload = new FormData();
    payload.set("name", form.name);
    payload.set("focus", form.focus);
    payload.set("isDefault", String(form.isDefault));
    payload.set("file", file);
    const res = await fetch("/api/cvs", { method: "POST", body: payload });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Upload failed.");
      return;
    }
    setForm({ name: "", focus: "fullstack", isDefault: false });
    setFile(null);
    setMessage("CV stored. Qualifying jobs will receive this file.");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/cvs/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold sm:text-3xl">CV versions</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Waqas Rafique&apos;s master CV is attached to every qualifying application.
        </p>
      </header>

      <form className="panel grid gap-3 p-5" onSubmit={upload}>
        <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder="CV name, e.g. Master Full Stack" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })}>
          <option value="fullstack">Full Stack</option>
          <option value="mern">MERN / React / Node</option>
          <option value="laravel">PHP / Laravel</option>
          <option value="python">Python / Django</option>
        </select>
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Default fallback CV
        </label>
        <button className="min-h-11 w-full rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#1b1406] sm:w-fit">
          Upload CV
        </button>
      </form>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

      <div className="space-y-3">
        {cvs.map((cv) => (
          <article key={cv._id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="font-medium">{cv.name}</p>
              <p className="text-sm text-[var(--muted)]">
                {cv.focus} · {cv.fileName} {cv.isDefault ? "· default" : ""}
              </p>
            </div>
            {cv._id === "master-cv" ? (
              <span className="text-sm text-[var(--ok)]">Active</span>
            ) : (
              <button onClick={() => remove(cv._id)} className="text-sm text-[var(--danger)]">
                Remove
              </button>
            )}
          </article>
        ))}
        {!cvs.length ? <p className="text-sm text-[var(--muted)]">No CV files uploaded yet.</p> : null}
      </div>
    </div>
  );
}
