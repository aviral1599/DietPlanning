"use client";

import { useCallback, useState } from "react";
import { conditionLabel } from "@/lib/glycemic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Analysis,
  CalcResults,
  DIET_TYPE_LABELS,
  DietType,
  MenuPlan,
  NutritionSettings,
  SubjectInfo,
} from "@/lib/types";
import AssessmentTab from "./AssessmentTab";
import AnalysisTab from "./AnalysisTab";
import MenuTab from "./MenuTab";
import ChartTab from "./chart/ChartTab";
import PortalTab from "./PortalTab";

export interface LoadedReport {
  id: string;
  status: string;
  aiProvider: string;
  subject: SubjectInfo;
  settings: NutritionSettings;
  results: CalcResults;
  menuPlan: MenuPlan;
  analysis: Analysis;
  clinicName: string;
  coachName: string;
  updatedAt: string;
}

type Tab = "assessment" | "analysis" | "menu" | "chart" | "portal";

export default function ReportWorkspace({
  initial,
  hasApiKey,
  initialTab,
}: {
  initial: LoadedReport;
  hasApiKey: boolean;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const [report, setReport] = useState<LoadedReport>(initial);
  const [tab, setTab] = useState<Tab>(initialTab ?? "assessment");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // Persist the full current report (menu/analysis/settings/status) without
  // re-running the engine, so coach edits are preserved.
  const saveEdits = useCallback(
    async (patch?: Partial<Pick<LoadedReport, "menuPlan" | "analysis" | "status">>) => {
      setSaving(true);
      try {
        const body = {
          recompute: false,
          settings: report.settings,
          menuPlan: patch?.menuPlan ?? report.menuPlan,
          analysis: patch?.analysis ?? report.analysis,
          status: patch?.status ?? report.status,
        };
        const res = await fetch(`/api/reports/${report.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        flash("Saved");
        router.refresh();
      } catch {
        flash("Save failed");
      } finally {
        setSaving(false);
      }
    },
    [report, router]
  );

  // Recompute the assessment from edited subject/settings.
  const recompute = useCallback(
    async (subject: SubjectInfo, settings: Partial<NutritionSettings>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/reports/${report.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...subject, settings, recompute: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        // Re-pull the fresh computed report.
        const fresh = await fetch(`/api/reports/${report.id}`).then((r) => r.json());
        const r = fresh.report;
        setReport((prev) => ({
          ...prev,
          subject,
          settings: JSON.parse(r.settings),
          results: JSON.parse(r.results),
          menuPlan: JSON.parse(r.menuPlan),
          analysis: JSON.parse(r.analysis),
          status: r.status,
        }));
        flash("Recalculated");
        router.refresh();
      } catch {
        flash("Recalculation failed");
      } finally {
        setSaving(false);
      }
    },
    [report.id, router]
  );

  const toggleStatus = async () => {
    const next = report.status === "final" ? "draft" : "final";
    setReport((p) => ({ ...p, status: next }));
    await saveEdits({ status: next });
  };

  const setMenuPlan = (menuPlan: MenuPlan) =>
    setReport((p) => ({ ...p, menuPlan }));
  const setAnalysis = (analysis: Analysis) =>
    setReport((p) => ({ ...p, analysis }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "assessment", label: "Assessment & Calculations" },
    { id: "analysis", label: "Analysis & Guidelines" },
    { id: "menu", label: "Exchange Menu" },
    { id: "chart", label: "Diet Chart" },
    { id: "portal", label: "Client Portal" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-brand-600">
            ← Back to clients
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {report.subject.clientName}
          </h1>
          <p className="text-sm text-slate-500">
            {report.subject.age} yr · {report.subject.sex} ·{" "}
            {conditionLabel(DIET_TYPE_LABELS[report.subject.dietType as DietType], report.subject.dietType as DietType, report.subject.glycemicStatus)} ·{" "}
            <span className="capitalize">{report.subject.dietPreference}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleStatus}
            className={`badge cursor-pointer ${
              report.status === "final"
                ? "bg-brand-100 text-brand-700"
                : "bg-amber-100 text-amber-700"
            }`}
            title="Toggle draft / final"
          >
            {report.status === "final" ? "● Final" : "○ Draft"}
          </button>
          <a
            className="btn-secondary text-xs"
            href={`/api/reports/${report.id}/export?format=excel`}
          >
            Excel
          </a>
          <a
            className="btn-secondary text-xs"
            href={`/api/reports/${report.id}/export?format=csv`}
          >
            CSV
          </a>
          <a
            className="btn-accent text-xs"
            href={`/api/reports/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇ PDF Report
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "assessment" && (
        <AssessmentTab report={report} onRecompute={recompute} saving={saving} />
      )}
      {tab === "analysis" && (
        <AnalysisTab
          report={report}
          hasApiKey={hasApiKey}
          onAnalysisChange={setAnalysis}
          onSave={(a) => saveEdits({ analysis: a })}
          saving={saving}
        />
      )}
      {tab === "menu" && (
        <MenuTab
          report={report}
          onMenuChange={setMenuPlan}
          onSave={(m) => saveEdits({ menuPlan: m })}
          saving={saving}
        />
      )}

      {tab === "chart" && <ChartTab reportId={report.id} subject={report.subject} />}
      {tab === "portal" && <PortalTab reportId={report.id} clientName={report.subject.clientName} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-30 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
