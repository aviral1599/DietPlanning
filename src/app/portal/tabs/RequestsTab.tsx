"use client";

import { describeRequest } from "@/lib/foodbank/changes";
import type { PortalRequestDTO } from "@/lib/foodbank/portal";
import type { Dish } from "@/lib/foodbank/types";
import { MEAL_TIME_LABELS, type MealTime } from "@/lib/types";

/** Requests: the client's change requests and their status (not restyled yet). */
export default function RequestsTab({
  requests,
  index,
  coachName,
  onCancel,
}: {
  requests: PortalRequestDTO[];
  index: Record<string, Dish>;
  coachName: string;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">My requests</h2>
      {requests.length === 0 && (
        <div className="card p-6 text-center text-sm text-slate-500">
          Want something different? Tap any dish in your plan and choose <b>Request a change</b>.
        </div>
      )}
      {requests.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">
                Day {r.day + 1} · {MEAL_TIME_LABELS[r.meal as MealTime]} · {new Date(r.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-800">{describeRequest(r, index)}</div>
              {r.note && <div className="mt-1 text-xs text-slate-500">Your note: “{r.note}”</div>}
              {r.coachNote && <div className="mt-1 text-xs text-brand-700">{coachName}: “{r.coachNote}”</div>}
            </div>
            <span className={`badge shrink-0 ${r.status === "approved" ? "bg-brand-100 text-brand-700" : r.status === "rejected" ? "bg-red-100 text-red-700" : r.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              {r.status === "rejected" ? "declined" : r.status}
            </span>
          </div>
          {r.status === "pending" && (
            <button className="mt-2 text-xs text-slate-500 underline" onClick={() => onCancel(r.id)}>Withdraw request</button>
          )}
        </div>
      ))}
    </div>
  );
}
