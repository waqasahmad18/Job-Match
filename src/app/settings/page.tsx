"use client";

import { listFromText } from "@/lib/format";
import type { UserSettings } from "@/types";
import { useEffect, useState } from "react";

const EMPTY: UserSettings = {
  locations: [],
  roles: [],
  targetTechnologies: [],
  excludedTechnologies: [],
  excludedCompanies: [],
  onsiteCities: [],
  skills: [],
  matchThreshold: 80,
  dailySendLimit: 20,
  minSalaryPkr: 80000,
  cooldownDays: 14,
  autoSend: true,
  applicantName: "",
  applicantEmail: "",
  smtpUser: "vickyksr2218@gmail.com",
  smtpPassword: "",
  smtpFrom: "Waqas Rafique <vickyksr2218@gmail.com>",
  smtpReady: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(EMPTY);
  const [lists, setLists] = useState({
    locations: "",
    roles: "",
    skills: "",
    excludedTechnologies: "",
    excludedCompanies: "",
    onsiteCities: "",
  });
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const next = data.settings as UserSettings;
        setSettings(next);
        setLists({
          locations: next.locations.join(", "),
          roles: next.roles.join("\n"),
          skills: next.skills.join(", "),
          excludedTechnologies: next.excludedTechnologies.join(", "),
          excludedCompanies: (next.excludedCompanies || []).join(", "),
          onsiteCities: (next.onsiteCities || []).join(", "),
        });
      });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        locations: listFromText(lists.locations),
        roles: listFromText(lists.roles),
        skills: listFromText(lists.skills),
        targetTechnologies: listFromText(lists.skills),
        excludedTechnologies: listFromText(lists.excludedTechnologies),
        excludedCompanies: listFromText(lists.excludedCompanies),
        onsiteCities: listFromText(lists.onsiteCities),
        smtpUser: settings.smtpUser,
        smtpFrom: settings.smtpFrom,
        smtpPassword: settings.smtpPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not save settings.");
      return;
    }
    setSettings(data.settings);
    setMessage("Settings saved. The next pipeline run will use them.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <header>
        <h2 className="text-2xl font-semibold sm:text-3xl">Settings</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Daily quota: 5–10 Lahore full-stack CVs and 20 companies total including worldwide remote.
          Other-city onsite is skipped. Interact Global is skipped.
        </p>
      </header>

      <form className="panel grid gap-4 p-5" onSubmit={save}>
        <label className="grid gap-2 text-sm">
          Applicant name
          <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.applicantName} onChange={(e) => setSettings({ ...settings, applicantName: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Applicant / reply email
          <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.applicantEmail} onChange={(e) => setSettings({ ...settings, applicantEmail: e.target.value })} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2 text-sm">
            Match threshold
            <input type="number" min={50} max={100} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.matchThreshold} onChange={(e) => setSettings({ ...settings, matchThreshold: Number(e.target.value) })} />
          </label>
          <label className="grid gap-2 text-sm">
            Daily send limit
            <input type="number" min={1} max={200} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.dailySendLimit} onChange={(e) => setSettings({ ...settings, dailySendLimit: Number(e.target.value) })} />
          </label>
          <label className="grid gap-2 text-sm">
            Minimum salary (PKR)
            <input type="number" min={0} step={1000} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.minSalaryPkr} onChange={(e) => setSettings({ ...settings, minSalaryPkr: Number(e.target.value) })} />
          </label>
          <label className="grid gap-2 text-sm">
            Company cooldown days
            <input type="number" min={0} max={90} className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.cooldownDays} onChange={(e) => setSettings({ ...settings, cooldownDays: Number(e.target.value) })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.autoSend} onChange={(e) => setSettings({ ...settings, autoSend: e.target.checked })} />
          Send automatically when a job clears the threshold
        </label>
        <div className="grid gap-3 rounded-2xl border border-[var(--line)] p-4">
          <p className="text-sm font-medium">Gmail SMTP (free)</p>
          <p className="text-sm text-[var(--muted)]">
            Host is smtp.gmail.com. Regular Gmail password will not work — paste a 16-character App Password.
            {settings.smtpReady ? " App Password is saved." : " App Password is not saved yet."}
          </p>
          <label className="grid gap-2 text-sm">
            Gmail address
            <input className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={settings.smtpUser} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} />
          </label>
          <label className="grid gap-2 text-sm">
            Gmail App Password
            <input type="password" autoComplete="off" className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" placeholder={settings.smtpReady ? "Saved — paste a new one to replace" : "xxxx xxxx xxxx xxxx"} value={settings.smtpPassword} onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })} />
          </label>
          <button
            type="button"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setMessage("Testing Gmail SMTP...");
              try {
                if (settings.smtpPassword.trim()) {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ smtpPassword: settings.smtpPassword, smtpUser: settings.smtpUser }),
                  });
                }
                const res = await fetch("/api/email/test", { method: "POST" });
                const data = await res.json();
                setMessage(res.ok ? `Test email sent to ${data.sentTo}` : data.error || "SMTP test failed.");
              } catch {
                setMessage("SMTP test failed.");
              } finally {
                setTesting(false);
              }
            }}
            className="w-fit rounded-full border border-[var(--line)] px-4 py-2 text-sm"
          >
            {testing ? "Sending..." : "Send test email to me"}
          </button>
        </div>
        <label className="grid gap-2 text-sm">
          Location policy
          <textarea className="min-h-20 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.locations} onChange={(e) => setLists({ ...lists, locations: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Onsite cities allowed
          <textarea className="min-h-16 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.onsiteCities} onChange={(e) => setLists({ ...lists, onsiteCities: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Excluded companies (current employer)
          <textarea className="min-h-16 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.excludedCompanies} onChange={(e) => setLists({ ...lists, excludedCompanies: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Target roles
          <textarea className="min-h-28 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.roles} onChange={(e) => setLists({ ...lists, roles: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Skills / technologies
          <textarea className="min-h-24 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.skills} onChange={(e) => setLists({ ...lists, skills: e.target.value })} />
        </label>
        <label className="grid gap-2 text-sm">
          Excluded technologies
          <textarea className="min-h-20 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2" value={lists.excludedTechnologies} onChange={(e) => setLists({ ...lists, excludedTechnologies: e.target.value })} />
        </label>
        <button className="min-h-11 w-full rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#1b1406] sm:w-fit">
          Save settings
        </button>
      </form>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
