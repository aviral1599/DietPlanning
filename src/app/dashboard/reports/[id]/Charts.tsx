"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EXCHANGE_UNITS } from "@/lib/exchange-data";
import {
  CalcResults,
  FOOD_GROUP_ORDER,
  MealTime,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
  MenuPlan,
} from "@/lib/types";

const COLORS = {
  protein: "#1fa974",
  fat: "#e2622a",
  cho: "#f4b942",
  rda: "#94a3b8",
  plan: "#12885d",
};

export function MacroPie({ results }: { results: CalcResults }) {
  const data = [
    { name: "Protein", value: results.protein.kcal, color: COLORS.protein },
    { name: "Fat", value: results.fat.kcal, color: COLORS.fat },
    { name: "Carbohydrate", value: results.cho.kcal, color: COLORS.cho },
  ];
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={2}
            label={(e) => `${Math.round((e.percent ?? 0) * 100)}%`}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v} kcal`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RdaComparisonChart({ results }: { results: CalcResults }) {
  const data = results.rdaComparison.map((r) => ({
    nutrient: r.nutrient.charAt(0) + r.nutrient.slice(1).toLowerCase(),
    RDA: r.rda,
    Planned: r.mrda,
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="nutrient" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Legend />
          <Bar dataKey="RDA" fill={COLORS.rda} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Planned" fill={COLORS.plan} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MealDistributionChart({ menuPlan }: { menuPlan: MenuPlan }) {
  const dist = menuPlan.distributive;
  const data = MEAL_TIMES.map((m: MealTime) => {
    let energy = 0;
    for (const g of FOOD_GROUP_ORDER) {
      const ex = dist?.[g]?.[m] ?? 0;
      energy += ex * EXCHANGE_UNITS[g].energy;
    }
    return { meal: MEAL_TIME_LABELS[m], kcal: Math.round(energy) };
  });
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="meal" fontSize={10} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v: number) => `${v} kcal`} />
          <Bar dataKey="kcal" fill={COLORS.plan} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
