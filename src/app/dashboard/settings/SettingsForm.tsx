"use client";

import { useState } from "react";

interface Initial {
  name: string;
  email: string;
  clinicName: string;
  hasApiKey: boolean;
}

export default function SettingsForm({ initial }: { initial: Initial }) {
  const [name, setName] = useState(initial.name);
  const [clinicName, setClinicName] = useState(initial.clinicName);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(body: Record<string, string>) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Could not save.");
        return;
      }
      setHasApiKey(data.hasApiKey);
      setMsg("Saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-brand-700">
          Profile
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-slate-50" value={initial.email} disabled />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Clinic / brand name (shown on reports)</label>
            <input
              className="input"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            className="btn-primary"
            disabled={saving}
            onClick={() => save({ name, clinicName })}
          >
            Save profile
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-brand-700">
          AI Analysis (optional)
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          NutriPlan works fully without AI using its built-in clinical engine.
          Add an Anthropic API key to enable Claude-enhanced narrative analysis
          and personalised recommendations on each report.
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              hasApiKey
                ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {hasApiKey ? "API key configured" : "No key — built-in only"}
          </span>
        </div>
        <div className="mt-4">
          <label className="label">Anthropic API key</label>
          <input
            className="input font-mono"
            type="password"
            placeholder={hasApiKey ? "•••••••••• (leave blank to keep)" : "sk-ant-…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Stored securely on the server and never shown in the browser.
          </p>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            className="btn-primary"
            disabled={saving || !apiKey.trim()}
            onClick={() => {
              save({ anthropicKey: apiKey });
              setApiKey("");
            }}
          >
            Save key
          </button>
          {hasApiKey && (
            <button
              className="btn-secondary"
              disabled={saving}
              onClick={() => save({ anthropicKey: "" })}
            >
              Remove key
            </button>
          )}
        </div>
      </section>

      {msg && (
        <div className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          {msg}
        </div>
      )}
    </div>
  );
}
