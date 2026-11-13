"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/foodbank/ui";
import { scaled } from "@/lib/foodbank/bank";
import { addDays } from "@/lib/foodbank/engine";
import { fmtDate, useDishes, type CustomDishRow } from "@/lib/foodbank/client";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";
import { describeRequest } from "@/lib/foodbank/changes";
import type { PendingRequest } from "../reports/[id]/chart/MealEditor";

interface Row extends PendingRequest {
  chartTitle: string;
  reportId: string;
  startDate: string;
  clientId: string;
  status: string;
  coachNote: string;
  resolvedAt: string | null;
}

export default function ApprovalsList() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "resolved">("pending");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [customRows, setCustomRows] = useState<CustomDishRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { index } = useDishes(customRows);

  const load = useCallback(async () => {
    setRows(null);
    const [r, d] = await Promise.all([
      fetch(`/api/requests?status=${tab}`).then((x) => x.json()),
      fetch("/api/foodbank/dishes").then((x) => x.json()),
    ]);
    setRows(r.requests ?? []);
    setCustomRows(d.dishes ?? []);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, coachNote: notes[id] ?? "" }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Could not resolve the request.");
    setBusy(null);
    await load();
    router.refresh(); // update the nav badge
  };

  const impact = (r: Row) => {
    const from = r.fromItem && index[r.fromItem.dishId] ? scaled(index[r.fromItem.dishId].perUnit, r.fromItem.units) : null;
    const to = r.toItem && index[r.toItem.dishId] ? scaled(index[r.toItem.dishId].perUnit, r.toItem.units) : null;
    const dk = (to?.kcal ?? 0) - (r.action === "add" ? 0 : from?.kcal ?? 0);
    const dp = (to?.protein ?? 0) - (r.action === "add" ? 0 : from?.protein ?? 0);
    return { dk: Math.round(dk), dp: Math.round(dp * 10) / 10 };
  };

  // group by client
  const groups = new Map<string, Row[]>();
  (rows ?? []).forEach((r) => groups.set(r.clientName, [...(groups.get(r.clientName) ?? []), r]));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Chip tone="brand" active={tab === "pending"} onClick={() => setTab("pending")}>Pending</Chip>
        <Chip tone="brand" active={tab === "resolved"} onClick={() => setTab("resolved")}>History</Chip>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {rows === null && <div className="card p-10 text-center text-sm text-slate-400">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-14 text-center">
          <div className="text-3xl">✅</div>
          <div className="font-semibold text-slate-800">{tab === "pending" ? "You’re all caught up" : "No resolved requests yet"}</div>
          <p className="max-w-sm text-sm text-slate-500">
            When a client asks to swap a dish or change a portion from their portal, it appears here for your approval.
          </p>
        </div>
      )}
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([client, list]) => (
          <section key={client}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{client}</h2>
            <div className="space-y-3">
              {list.map((r) => {
                const { dk, dp } = impact(r);
                const date = addDays(r.startDate, r.day);
                return (
                  <div key={r.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">
                          {r.chartTitle} · Day {r.day + 1} ({fmtDate(date)}) · {MEAL_TIME_LABELS[r.meal as MealTime]}
                        </div>
                        <div className="mt-0.5 font-medium text-slate-900">{describeRequest(r, index)}</div>
                        {r.note && <div className="mt-1 text-sm text-slate-600">“{r.note}”</div>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Chip size="sm" tone={Math.abs(dk) <= 60 ? "brand" : "amber"}>
                            {dk >= 0 ? "+" : ""}{dk} kcal
                          </Chip>
                          <Chip size="sm" tone={dp >= -3 ? "brand" : "amber"}>
                            {dp >= 0 ? "+" : ""}{dp} g protein
                          </Chip>
                          <span className="text-[11px] text-slate-400">requested {new Date(r.createdAt).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      {tab === "pending" ? (
                        <div className="flex w-full flex-col gap-2 sm:w-64">
                          <input
                            className="input py-1.5 text-xs"
                            placeholder="Optional note to client"
                            value={notes[r.id] ?? ""}
                            onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <button className="btn-primary flex-1 py-1.5 text-xs" disabled={busy === r.id} onClick={() => resolve(r.id, "approve")}>
                              Approve
                            </button>
                            <button className="btn-secondary flex-1 py-1.5 text-xs" disabled={busy === r.id} onClick={() => resolve(r.id, "reject")}>
                              Decline
                            </button>
                          </div>
                          <Link href={`/dashboard/reports/${r.reportId}?tab=chart`} className="text-center text-xs text-brand-700 hover:underline">
                            Open chart →
                          </Link>
                        </div>
                      ) : (
                        <div className="text-right text-xs">
                          <span
                            className={`badge ${
                              r.status === "approved" ? "bg-brand-100 text-brand-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {r.status}
                          </span>
                          {r.coachNote && <div className="mt-1 max-w-[16rem] text-slate-500">Note: {r.coachNote}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
