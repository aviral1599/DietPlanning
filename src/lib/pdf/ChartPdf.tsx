import { conditionLabel } from "../glycemic";
import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPortion } from "../foodbank/bank";
import { dayTotals, groceryList, type ChartDay, type ChartTargets } from "../foodbank/engine";
import type { Dish } from "../foodbank/types";
import { DIET_TYPE_LABELS, MEAL_TIMES, MEAL_TIME_LABELS, type MealTime, type SubjectInfo } from "../types";

const BRAND = "#12885d";
const LIGHT = "#eefdf6";
const BORDER = "#cbd5e1";

/** Built-in PDF fonts only cover WinAnsi; map or drop anything else. */
export function pdfSafe(s: string): string {
  return s
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/[^\u0000-ÿ–—‘’“”•…]/g, "");
}

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 7, color: "#1e293b", fontFamily: "Helvetica" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 5, marginBottom: 8 },
  clinic: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  muted: { color: "#64748b", fontSize: 7 },
  row: { flexDirection: "row" },
  th: { backgroundColor: LIGHT, fontFamily: "Helvetica-Bold", fontSize: 7, padding: 3, borderWidth: 0.5, borderColor: BORDER },
  td: { padding: 3, borderWidth: 0.5, borderColor: BORDER },
  item: { marginBottom: 2 },
  portion: { color: "#64748b", fontSize: 6 },
  section: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND, marginTop: 8, marginBottom: 4, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 12, left: 22, right: 22, fontSize: 6, color: "#94a3b8", flexDirection: "row", justifyContent: "space-between" },
});

export interface ChartPdfProps {
  title: string;
  clinicName: string;
  coachName: string;
  subject: SubjectInfo | null;
  days: ChartDay[];
  targets: ChartTargets;
  mealTimes: Record<MealTime, string>;
  notes: string;
  index: Record<string, Dish>;
}

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function ChartPdf({ title, clinicName, coachName, subject, days, targets, mealTimes, notes, index }: ChartPdfProps) {
  const weeks: ChartDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const meals = MEAL_TIMES.filter((m) => days.some((d) => d.meals[m]?.length));
  const header = (sub: string) => (
    <View style={s.head} fixed>
      <View>
        <Text style={s.clinic}>{pdfSafe(clinicName)}</Text>
        <Text style={s.title}>{pdfSafe(title)}{subject ? ` - ${pdfSafe(subject.clientName)}` : ""}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.muted}>{sub}</Text>
        <Text style={s.muted}>
          Target: {targets.kcal} kcal / day · Protein {targets.protein} g
          {subject ? ` · ${conditionLabel(DIET_TYPE_LABELS[subject.dietType], subject.dietType, subject.glycemicStatus)} · ${subject.dietPreference}` : ""}
        </Text>
      </View>
    </View>
  );
  const footer = (
    <View style={s.footer} fixed>
      <Text>Prepared by {pdfSafe(coachName)} · NutriPlan · Nutrition values computed from IFCT 2017 (ICMR-NIN)</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );

  return (
    <Document title={pdfSafe(title)}>
      {weeks.map((week, wi) => {
        const colW = (794 - 78) / week.length;
        const grocery = groceryList(week, index);
        return (
          <React.Fragment key={wi}>
            <Page size="A4" orientation="landscape" style={s.page}>
              {header(`Week ${wi + 1} · ${fmt(week[0].date)} - ${fmt(week[week.length - 1].date)}`)}
              <View style={s.row}>
                <Text style={[s.th, { width: 78 }]}>Meal</Text>
                {week.map((d) => (
                  <Text key={d.day} style={[s.th, { width: colW }]}>Day {d.day + 1} · {fmt(d.date)}</Text>
                ))}
              </View>
              {meals.map((m) => (
                <View key={m} style={s.row} wrap={false}>
                  <View style={[s.td, { width: 78 }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{MEAL_TIME_LABELS[m]}</Text>
                    <Text style={s.portion}>{mealTimes[m] ?? ""}</Text>
                  </View>
                  {week.map((d) => (
                    <View key={d.day} style={[s.td, { width: colW }]}>
                      {(d.meals[m] ?? []).map((it) => {
                        const dish = index[it.dishId];
                        if (!dish) return null;
                        return (
                          <View key={it.uid} style={s.item}>
                            <Text>{pdfSafe(dish.name)}</Text>
                            <Text style={s.portion}>{pdfSafe(formatPortion(dish, it.units))}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ))}
              <View style={s.row} wrap={false}>
                <Text style={[s.th, { width: 78 }]}>Day total</Text>
                {week.map((d) => {
                  const t = dayTotals(d, index);
                  return (
                    <Text key={d.day} style={[s.th, { width: colW, fontFamily: "Helvetica" }]}>
                      {Math.round(t.kcal)} kcal · P {Math.round(t.protein)} g · C {Math.round(t.carbs)} g · F {Math.round(t.fat)} g
                    </Text>
                  );
                })}
              </View>
              {wi === 0 && notes.trim() && (
                <View wrap={false}>
                  <Text style={s.section}>Note from your nutritionist</Text>
                  <Text style={{ fontSize: 8, lineHeight: 1.4 }}>{pdfSafe(notes)}</Text>
                </View>
              )}
              {footer}
            </Page>
            <Page size="A4" orientation="landscape" style={s.page}>
              {header(`Grocery list · Week ${wi + 1}`)}
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Object.entries(grocery).map(([cat, lines]) => (
                  <View key={cat} style={{ width: "33%", paddingRight: 10, marginBottom: 6 }} wrap={false}>
                    <Text style={s.section}>{pdfSafe(cat)}</Text>
                    {lines.map((l) => (
                      <View key={l.key} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 1.5 }}>
                        <Text style={{ fontSize: 7.5 }}>[  ] {pdfSafe(l.name)}</Text>
                        <Text style={{ fontSize: 7.5, color: "#475569" }}>{l.display}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              {footer}
            </Page>
          </React.Fragment>
        );
      })}
    </Document>
  );
}
