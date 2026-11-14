"use client";

import Link from "next/link";
import { conditionsLabel, subjectConditions } from "@/lib/conditions";
import type { GlycemicStatus } from "@/lib/types";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface ReportRow {
  id: string;
  clientName: string;
  age: number;
  sex: string;
  dietType: string;
  conditions?: string;
  glycemicStatus?: string;
  dietPreference: string;
  status: string;
  energy: number;
  bmi: number;
  updatedAt: string;
}

function label(r: { dietType: string; conditions?: string; glycemicStatus?: string }) {
  return conditionsLabel(subjectConditions(r), r.glycemicStatus as GlycemicStatus);
}

export default function ClientList({ rows }: { rows: ReportRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(s) ||
        label(r)
          .toLowerCase()
          .includes(s)
    );
  }, [q, rows]);

  async function del(id: string, name: string) {
    if (!confirm(`Delete the plan for ${name}? This cannot be undone.`)) return;
    setBusy(id);
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search by client name or condition…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Client</th>
                <th className="th">Age / Sex</th>
                <th className="th">Condition</th>
                <th className="th">Diet</th>
                <th className="th">BMI</th>
                <th className="th">Target kcal</th>
                <th className="th">Status</th>
                <th className="th">Updated</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td font-semibold text-slate-800">
                    <Link
                      href={`/dashboard/reports/${r.id}`}
                      className="hover:text-brand-700 hover:underline"
                    >
                      {r.clientName}
                    </Link>
                  </td>
                  <td className="td capitalize text-slate-600">
                    {r.age} / {r.sex}
                  </td>
                  <td className="td text-slate-600">
                    {label(r)}
                  </td>
                  <td className="td capitalize text-slate-600">
                    {r.dietPreference}
                  </td>
                  <td className="td text-slate-600">{r.bmi || "—"}</td>
                  <td className="td text-slate-600">{r.energy || "—"}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        r.status === "final"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="td text-slate-500">
                    {new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                  </td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/dashboard/reports/${r.id}`}
                        className="btn-ghost text-xs"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => del(r.id, r.clientName)}
                        disabled={busy === r.id}
                        className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="td text-center text-slate-400" colSpan={9}>
                    No clients match &ldquo;{q}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
