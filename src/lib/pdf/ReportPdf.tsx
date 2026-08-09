import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  Analysis,
  CalcResults,
  DIET_TYPE_LABELS,
  DietType,
  FOOD_GROUP_LABELS,
  FOOD_GROUP_ORDER,
  MEAL_TIMES,
  MEAL_TIME_LABELS,
  MenuPlan,
  SubjectInfo,
} from "../types";

const BRAND = "#12885d";
const LIGHT = "#eefdf6";
const BORDER = "#cbd5e1";

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: "#1e293b", fontFamily: "Helvetica" },
  brandBar: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 6,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  clinic: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND },
  subtitle: { fontSize: 8, color: "#64748b" },
  h1: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginTop: 14,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row" },
  // generic table
  th: {
    backgroundColor: LIGHT,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: 4,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  td: { fontSize: 8, padding: 4, borderWidth: 0.5, borderColor: BORDER },
  // two-column info grid
  infoCell: {
    width: "50%",
    flexDirection: "row",
    paddingVertical: 2,
  },
  infoLabel: { width: "45%", color: "#64748b", fontSize: 8 },
  infoVal: { width: "55%", fontFamily: "Helvetica-Bold", fontSize: 8 },
  statBox: {
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 3,
    padding: 6,
    marginRight: 6,
    flexGrow: 1,
  },
  statLabel: { fontSize: 7, color: "#64748b", textTransform: "uppercase" },
  statVal: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND },
  bullet: { flexDirection: "row", marginBottom: 2, paddingRight: 8 },
  bulletDot: { width: 8, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, fontSize: 8 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 4,
    fontSize: 7,
    color: "#94a3b8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoCell}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoVal}>{value || "—"}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statVal}>{value}</Text>
    </View>
  );
}

function Bullets({ items, cross }: { items: string[]; cross?: boolean }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>{cross ? "×" : "•"}</Text>
          <Text style={s.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export interface ReportPdfProps {
  subject: SubjectInfo;
  results: CalcResults;
  menuPlan: MenuPlan;
  analysis: Analysis;
  clinicName: string;
  coachName: string;
  date: string;
}

export function ReportPdf(props: ReportPdfProps) {
  const { subject, results, menuPlan, analysis, clinicName, coachName, date } =
    props;
  const heightM = (subject.heightCm / 100).toFixed(2);

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text>{clinicName} · Diet Plan</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${subject.clientName} · Page ${pageNumber}/${totalPages}`
        }
      />
    </View>
  );

  const Header = () => (
    <View style={s.brandBar}>
      <View>
        <Text style={s.clinic}>{clinicName}</Text>
        <Text style={s.subtitle}>Clinical Diet Plan · Case Study</Text>
      </View>
      <View>
        <Text style={s.subtitle}>Prepared by: {coachName}</Text>
        <Text style={s.subtitle}>Date: {date}</Text>
      </View>
    </View>
  );

  return (
    <Document>
      {/* PAGE 1 — assessment */}
      <Page size="A4" style={s.page}>
        <Header />
        <Text style={s.h1}>{subject.clientName}</Text>
        {subject.objective ? (
          <Text style={{ fontSize: 8, color: "#475569", marginBottom: 4 }}>
            Objective: {subject.objective}
          </Text>
        ) : null}

        <Text style={s.sectionTitle}>Subject&apos;s General Information</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <InfoRow label="Name" value={subject.clientName} />
          <InfoRow label="Age" value={`${subject.age} yr`} />
          <InfoRow label="Sex" value={subject.sex} />
          <InfoRow label="Height" value={`${subject.heightCm} cm (${heightM} m)`} />
          <InfoRow label="Weight" value={`${subject.weightKg} kg`} />
          <InfoRow label="Activity level" value={subject.activityLevel} />
          <InfoRow label="Income group" value={subject.incomeGroup} />
          <InfoRow label="Diet preference" value={subject.dietPreference} />
          <InfoRow
            label="Condition / goal"
            value={DIET_TYPE_LABELS[subject.dietType as DietType]}
          />
          <InfoRow label="Food allergies" value={subject.allergies || "None"} />
        </View>

        <Text style={s.sectionTitle}>Assessment</Text>
        <View style={s.row}>
          <Stat label="IBW" value={`${results.ibw} kg`} />
          <Stat label="BMI" value={`${results.bmi}`} />
          <Stat label="BMR" value={`${results.bmr}`} />
          <Stat label="Energy" value={`${results.energy}`} />
        </View>
        <View style={[s.row, { marginTop: 6 }]}>
          <Stat label="Protein" value={`${results.protein.grams} g`} />
          <Stat label="Fat" value={`${results.fat.grams} g`} />
          <Stat label="CHO" value={`${results.cho.grams} g`} />
          <Stat label="Wt status" value={`${results.weightStatus} kg`} />
        </View>
        <Text style={{ fontSize: 7, color: "#64748b", marginTop: 4 }}>
          BMI category: {results.bmiCategory} · {results.weightStatusLabel} ·
          BMR method: {results.bmrMethodLabel} · IBW: {results.ibwMethodLabel}
        </Text>

        <Text style={s.sectionTitle}>Energy Requirement</Text>
        <View>
          <View style={s.row}>
            <Text style={[s.th, { width: "70%" }]}>Component</Text>
            <Text style={[s.th, { width: "30%", textAlign: "right" }]}>kcal</Text>
          </View>
          {[
            ["BMR", results.bmr],
            [`Physical activity (PA)`, results.pa],
            [`SDA / thermic effect`, results.sda],
            ["Total Energy Expenditure (TEE)", results.tee],
            ...(results.goalAdjustment
              ? [["Goal adjustment", results.goalAdjustment] as [string, number]]
              : []),
            ["TARGET ENERGY", results.energy],
          ].map(([k, v], i) => (
            <View style={s.row} key={i}>
              <Text style={[s.td, { width: "70%" }]}>{k as string}</Text>
              <Text style={[s.td, { width: "30%", textAlign: "right" }]}>
                {v as number}
              </Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Comparison Table (RDA vs MRDA)</Text>
        <View>
          <View style={s.row}>
            <Text style={[s.th, { width: "34%" }]}>Nutrient</Text>
            <Text style={[s.th, { width: "22%", textAlign: "right" }]}>RDA</Text>
            <Text style={[s.th, { width: "22%", textAlign: "right" }]}>MRDA</Text>
            <Text style={[s.th, { width: "22%", textAlign: "right" }]}>Diff.</Text>
          </View>
          {results.rdaComparison.map((r) => (
            <View style={s.row} key={r.nutrient}>
              <Text style={[s.td, { width: "34%" }]}>
                {r.nutrient} ({r.unit})
              </Text>
              <Text style={[s.td, { width: "22%", textAlign: "right" }]}>{r.rda}</Text>
              <Text style={[s.td, { width: "22%", textAlign: "right" }]}>{r.mrda}</Text>
              <Text style={[s.td, { width: "22%", textAlign: "right" }]}>
                {r.difference > 0 ? "+" : ""}
                {r.difference}
              </Text>
            </View>
          ))}
        </View>
        <Footer />
      </Page>

      {/* PAGE 2 — analysis */}
      <Page size="A4" style={s.page}>
        <Header />
        <Text style={s.sectionTitle}>Dietary Goals</Text>
        <Bullets items={analysis.dietaryGoals} />

        {analysis.aiNarrative ? (
          <>
            <Text style={s.sectionTitle}>Clinical Narrative</Text>
            <Text style={{ fontSize: 8, lineHeight: 1.4 }}>
              {analysis.aiNarrative}
            </Text>
          </>
        ) : null}

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "50%", paddingRight: 6 }}>
            <Text style={s.sectionTitle}>Do&apos;s</Text>
            <Bullets items={analysis.dos} />
          </View>
          <View style={{ width: "50%" }}>
            <Text style={s.sectionTitle}>Don&apos;ts</Text>
            <Bullets items={analysis.donts} cross />
          </View>
        </View>

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "50%", paddingRight: 6 }}>
            <Text style={s.sectionTitle}>Foods to Include</Text>
            <Bullets items={analysis.foodsToInclude} />
          </View>
          <View style={{ width: "50%" }}>
            <Text style={s.sectionTitle}>Foods to Exclude</Text>
            <Bullets items={analysis.foodsToExclude} cross />
          </View>
        </View>
        <Footer />
      </Page>

      {/* PAGE 3 — menus */}
      <Page size="A4" style={s.page}>
        <Header />
        <Text style={s.sectionTitle}>Comprehensive Menu (Exchanges)</Text>
        <View>
          <View style={s.row}>
            <Text style={[s.th, { width: "34%" }]}>Food Group</Text>
            <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Exch.</Text>
            <Text style={[s.th, { width: "14%", textAlign: "right" }]}>kcal</Text>
            <Text style={[s.th, { width: "12%", textAlign: "right" }]}>P</Text>
            <Text style={[s.th, { width: "12%", textAlign: "right" }]}>F</Text>
            <Text style={[s.th, { width: "14%", textAlign: "right" }]}>CHO</Text>
          </View>
          {menuPlan.comprehensive?.map((r) => (
            <View style={s.row} key={r.group}>
              <Text style={[s.td, { width: "34%" }]}>
                {FOOD_GROUP_LABELS[r.group]}
              </Text>
              <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{r.exchanges}</Text>
              <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{r.energy}</Text>
              <Text style={[s.td, { width: "12%", textAlign: "right" }]}>{r.protein}</Text>
              <Text style={[s.td, { width: "12%", textAlign: "right" }]}>{r.fat}</Text>
              <Text style={[s.td, { width: "14%", textAlign: "right" }]}>{r.cho}</Text>
            </View>
          ))}
          <View style={s.row}>
            <Text style={[s.td, { width: "34%", fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
            <Text style={[s.td, { width: "14%" }]}></Text>
            <Text style={[s.td, { width: "14%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{menuPlan.totals?.energy}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{menuPlan.totals?.protein}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{menuPlan.totals?.fat}</Text>
            <Text style={[s.td, { width: "14%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{menuPlan.totals?.cho}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Distributive Menu (Exchanges by Meal)</Text>
        <View>
          <View style={s.row}>
            <Text style={[s.th, { width: "22%" }]}>Group</Text>
            {MEAL_TIMES.map((m) => (
              <Text key={m} style={[s.th, { width: "11.14%", textAlign: "center", fontSize: 6 }]}>
                {MEAL_TIME_LABELS[m]}
              </Text>
            ))}
          </View>
          {FOOD_GROUP_ORDER.map((g) => (
            <View style={s.row} key={g}>
              <Text style={[s.td, { width: "22%", fontSize: 7 }]}>
                {FOOD_GROUP_LABELS[g]}
              </Text>
              {MEAL_TIMES.map((m) => {
                const v = menuPlan.distributive?.[g]?.[m] ?? 0;
                return (
                  <Text
                    key={m}
                    style={[s.td, { width: "11.14%", textAlign: "center", fontSize: 7 }]}
                  >
                    {v || "—"}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Descriptive Menu</Text>
        <View>
          <View style={s.row}>
            <Text style={[s.th, { width: "18%" }]}>Meal</Text>
            <Text style={[s.th, { width: "34%" }]}>Recipe</Text>
            <Text style={[s.th, { width: "30%" }]}>Ingredients</Text>
            <Text style={[s.th, { width: "9%", textAlign: "right" }]}>kcal</Text>
            <Text style={[s.th, { width: "9%", textAlign: "right" }]}>P</Text>
          </View>
          {menuPlan.descriptive?.map((it) => (
            <View style={s.row} key={it.id}>
              <Text style={[s.td, { width: "18%", fontSize: 7 }]}>
                {MEAL_TIME_LABELS[it.mealTime]}
              </Text>
              <Text style={[s.td, { width: "34%", fontSize: 7 }]}>{it.recipe}</Text>
              <Text style={[s.td, { width: "30%", fontSize: 7 }]}>{it.ingredients}</Text>
              <Text style={[s.td, { width: "9%", textAlign: "right", fontSize: 7 }]}>{it.energy}</Text>
              <Text style={[s.td, { width: "9%", textAlign: "right", fontSize: 7 }]}>{it.protein}</Text>
            </View>
          ))}
        </View>
        <Footer />
      </Page>
    </Document>
  );
}
