"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PortalStatus {
  clientId: string | null;
  email: string | null;
  enabled: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
}

export default function PortalTab({ reportId, clientName }: { reportId: string; clientName: string }) {
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [pending, setPending] = useState(0);
  const [sharedChart, setSharedChart] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/${reportId}/portal`)
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.portal);
        setPending(d.pending ?? 0);
        setEmail(d.portal?.email ?? "");
      });
    fetch(`/api/reports/${reportId}/charts`)
      .then((r) => r.json())
      .then((d) => setSharedChart(d.charts?.find((c: { shared: boolean }) => c.shared)?.title ?? null));
  }, [reportId]);

  const save = async (resetPassword = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.portal);
      setPassword(data.password ?? null);
      setEditingEmail(false);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm(`Pause ${clientName}'s portal access? Their plan and history are kept.`)) return;
    setBusy(true);
    const data = await fetch(`/api/reports/${reportId}/portal`, { method: "DELETE" }).then((r) => r.json());
    setStatus(data.portal);
    setPassword(null);
    setBusy(false);
  };

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";
  const message = `Hi ${clientName.split(" ")[0]}, your personalised diet plan is ready on NutriPlan.\n\nLogin: ${loginUrl}\nEmail: ${status?.email ?? email}\nPassword: ${password}\n\nYou can see your daily meals, grocery list and guidelines, and request changes from there.`;

  if (!status) return <div className="card p-10 text-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Client portal access</h2>
          <span className={`badge ${status.enabled ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
            {status.enabled ? "● Active" : "○ Not active"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Give <b>{clientName}</b> their own login to view their plan on any phone or computer.
        </p>

        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {(!status.enabled || editingEmail) && (
          <div className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="clientEmail">Client email (their login)</label>
              <input id="clientEmail" type="email" className="input max-w-md" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy || !email} onClick={() => save(false)}>
                {busy ? "Saving…" : status.hasPassword ? "Save & enable access" : "Create login"}
              </button>
              {editingEmail && (
                <button className="btn-ghost" onClick={() => setEditingEmail(false)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {status.enabled && !editingEmail && (
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="label">Login email</dt>
              <dd className="font-medium text-slate-800">{status.email}</dd>
            </div>
            <div>
              <dt className="label">Last login</dt>
              <dd className="text-slate-700">{status.lastLoginAt ? new Date(status.lastLoginAt).toLocaleString("en-IN") : "Not yet"}</dd>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button className="btn-secondary text-xs" disabled={busy} onClick={() => save(true)}>
                Reset password
              </button>
              <button className="btn-secondary text-xs" onClick={() => setEditingEmail(true)}>
                Change email
              </button>
              <button className="btn-ghost text-xs text-red-600" disabled={busy} onClick={revoke}>
                Pause access
              </button>
            </div>
          </dl>
        )}

        {password && (
          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="text-sm font-semibold text-brand-800">Login created — share these details with {clientName}</div>
            <div className="mt-2 grid gap-1 font-mono text-sm text-slate-800">
              <div>URL: {loginUrl}</div>
              <div>Email: {status.email}</div>
              <div>
                Password: <b>{password}</b>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="btn-primary text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "✓ Copied" : "Copy message"}
              </button>
              <span className="text-xs text-slate-500">This password is shown only once. Use “Reset password” to issue a new one.</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card p-5 text-sm">
          <div className="font-semibold text-slate-800">What the client sees</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
            <li>Today’s meals with timings, portions and recipes</li>
            <li>The full weekly / monthly chart</li>
            <li>A weekly grocery list</li>
            <li>Their assessment, goals and do’s &amp; don’ts</li>
            <li>A way to request dish swaps or portion changes — you approve or decline</li>
          </ul>
        </div>
        <div className="card p-5 text-sm">
          <div className="font-semibold text-slate-800">Shared plan</div>
          <p className="mt-1 text-slate-600">
            {sharedChart ? (
              <>“{sharedChart}” is visible to the client.</>
            ) : (
              <>No chart is shared yet. Turn on <b>Share with client</b> in the Diet Chart tab.</>
            )}
          </p>
          {pending > 0 && (
            <Link href="/dashboard/approvals" className="mt-3 inline-flex text-sm font-semibold text-amber-700 hover:underline">
              {pending} pending request{pending > 1 ? "s" : ""} → Review
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
