import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell
} from "recharts";

// ============================================================
// MOCK DATA & API LAYER
// Szkielet gotowy do podpięcia prawdziwego backendu (MS/KIRP/NRA)
// ============================================================

const API_CONFIG = {
  MS_BASE:   "https://api.ms.gov.pl/v1",       // hipotetyczny endpoint MS
  KIRP_BASE: "https://api.kirp.pl/v1",          // hipotetyczny endpoint KIRP
  NRA_BASE:  "https://api.nra.pl/v1",           // hipotetyczny endpoint NRA
};

// Funkcje asynchroniczne – gotowe do podpięcia pod prawdziwe API
async function fetchDemographicsFromMS() {
  // PROD: return fetch(`${API_CONFIG.MS_BASE}/lawyers/demographics`).then(r => r.json());
  await new Promise(r => setTimeout(r, 400));
  return generateDemographicsMock();
}
async function fetchSalariesFromKIRP(filters = {}) {
  // PROD: return fetch(`${API_CONFIG.KIRP_BASE}/salaries?${new URLSearchParams(filters)}`).then(r => r.json());
  await new Promise(r => setTimeout(r, 300));
  return generateSalariesMock(filters);
}
async function fetchSalariesFromNRA(filters = {}) {
  // PROD: return fetch(`${API_CONFIG.NRA_BASE}/salaries?${new URLSearchParams(filters)}`).then(r => r.json());
  await new Promise(r => setTimeout(r, 300));
  return generateSalariesMock(filters, "adwokat");
}

// ── Prognozowanie CAGR ──────────────────────────────────────
function calcCAGR(startValue, endValue, years) {
  return Math.pow(endValue / startValue, 1 / years) - 1;
}
function projectCAGR(lastValue, cagr, years) {
  return Array.from({ length: years }, (_, i) => Math.round(lastValue * Math.pow(1 + cagr, i + 1)));
}

// ── Generator danych demograficznych ───────────────────────
function generateDemographicsMock() {
  const HIST_YEARS = [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
  const base = {
    radcowie:    [27500,29100,31200,33800,36100,38400,40200,42100,43900,45800,47200],
    adwokaci:    [15200,15900,16700,17500,18200,18900,19400,19900,20500,21100,21600],
    apRradcowscy:[5800, 6100, 6400, 6700, 6900, 7100, 7200, 7300, 7400, 7500, 7600],
    apAdwokaccy: [3800, 3900, 4000, 4100, 4150, 4200, 4100, 4050, 4000, 4050, 4100],
  };

  const lastIdx = base.radcowie.length - 1;
  const cagrR  = calcCAGR(base.radcowie[0],    base.radcowie[lastIdx],    lastIdx);
  const cagrA  = calcCAGR(base.adwokaci[0],    base.adwokaci[lastIdx],    lastIdx);
  const cagrAR = calcCAGR(base.apRradcowscy[0],base.apRradcowscy[lastIdx],lastIdx);
  const cagrAA = calcCAGR(base.apAdwokaccy[0], base.apAdwokaccy[lastIdx], lastIdx);

  const projR  = projectCAGR(base.radcowie[lastIdx],    cagrR,  5);
  const projA  = projectCAGR(base.adwokaci[lastIdx],    cagrA,  5);
  const projAR = projectCAGR(base.apRradcowscy[lastIdx],cagrAR, 5);
  const projAA = projectCAGR(base.apAdwokaccy[lastIdx], cagrAA, 5);

  const historical = HIST_YEARS.map((year, i) => ({
    year, estimated: false,
    radcowie:    base.radcowie[i],
    adwokaci:    base.adwokaci[i],
    apRradcowscy:base.apRradcowscy[i],
    apAdwokaccy: base.apAdwokaccy[i],
  }));

  const forecast = [2025,2026,2027,2028,2029].map((year, i) => ({
    year, estimated: true,
    radcowie:    projR[i],
    adwokaci:    projA[i],
    apRradcowscy:projAR[i],
    apAdwokaccy: projAA[i],
  }));

  return {
    data: [...historical, ...forecast],
    cagr: { radcowie: cagrR, adwokaci: cagrA },
    totals: {
      radcowie:    base.radcowie[lastIdx],
      adwokaci:    base.adwokaci[lastIdx],
      apRradcowscy:base.apRradcowscy[lastIdx],
      apAdwokaccy: base.apAdwokaccy[lastIdx],
    },
    projectedIn5y: {
      radcowie: projR[4],
      adwokaci: projA[4],
    }
  };
}

// ── Generator danych o zarobkach ───────────────────────────
const SALARY_BASE = {
  radca: {
    kobieta: { "25-34":6800,"35-44":9200,"45-54":12500,"55+":11000 },
    mezczyzna:{ "25-34":7400,"35-44":11500,"45-54":15800,"55+":13500 },
  },
  adwokat: {
    kobieta: { "25-34":6200,"35-44":8800,"45-54":11800,"55+":10500 },
    mezczyzna:{ "25-34":7100,"35-44":10800,"45-54":14900,"55+":12800 },
  },
  aplikant: {
    kobieta: { "25-34":3500,"35-44":4000,"45-54":4200,"55+":4500 },
    mezczyzna:{ "25-34":3800,"35-44":4300,"45-54":4600,"55+":4800 },
  },
};
const SPEC_MULTIPLIERS = {
  "Prawo Spółek": 1.35,
  "IP / IT":      1.42,
  "Podatki":      1.38,
  "Prawo Pracy":  1.00,
  "Prawo Karne":  0.90,
  "Inne":         0.95,
};

function generateSalariesMock(filters, forceType) {
  const gender = filters.gender || "all";
  const age    = filters.age    || "all";
  const spec   = filters.spec   || "all";
  const specMult = spec !== "all" ? (SPEC_MULTIPLIERS[spec] ?? 1) : 1;

  const types  = forceType ? [forceType] : ["radca","adwokat","aplikant"];
  const genders = gender === "all" ? ["kobieta","mezczyzna"] : [gender];
  const ages    = age    === "all" ? ["25-34","35-44","45-54","55+"] : [age];

  return types.map(type => {
    const vals = genders.flatMap(g => ages.map(a => {
      const base = SALARY_BASE[type]?.[g]?.[a] ?? 7000;
      return Math.round(base * specMult);
    }));
    const avg = Math.round(vals.reduce((s,v) => s+v, 0) / vals.length);
    const label = type === "radca" ? "Radca Prawny" : type === "adwokat" ? "Adwokat" : "Aplikant";
    return { type, label, avg, vals };
  });
}

function generateScatterData(filters) {
  const specMult = filters.spec !== "all" ? (SPEC_MULTIPLIERS[filters.spec] ?? 1) : 1;
  const points = [];
  for (let i = 0; i < 120; i++) {
    const exp = Math.round(Math.random() * 30 + 1);
    const base = 4000 + exp * 400 + Math.random() * 3000;
    points.push({ exp, salary: Math.round(base * specMult), r: Math.random() * 5 + 3 });
  }
  return points;
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg:      "#080c10",
  surface: "#0e1318",
  card:    "#121920",
  border:  "#1e2d3d",
  muted:   "#4a6070",
  text:    "#c8dae8",
  dim:     "#7a9ab0",
  radca:   "#00d4ff",
  adwokat: "#ff6b35",
  apR:     "#00ff9f",
  apA:     "#ffcc00",
  est:     "#8b5cf6",
  accent:  "#00d4ff",
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

function KPICard({ icon, label, value, sub, color, trend }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: "1.4rem 1.6rem",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: color,
        boxShadow: `0 0 12px ${color}88`,
      }}/>
      <div style={{ fontSize: "1.5rem", marginBottom: ".4rem" }}>{icon}</div>
      <div style={{ fontSize: ".65rem", letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, marginBottom: ".3rem" }}>{label}</div>
      <div style={{ fontSize: "1.9rem", fontWeight: 700, color: "#e8f4ff", lineHeight: 1, marginBottom: ".35rem" }}>{value}</div>
      <div style={{ fontSize: ".7rem", color: C.dim, lineHeight: 1.4 }}>{sub}</div>
      {trend && (
        <div style={{
          marginTop: ".6rem", fontSize: ".68rem", fontWeight: 600,
          color: trend > 0 ? "#00ff9f" : "#ff6b6b",
        }}>
          {trend > 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% CAGR
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: "1.2rem" }}>
      <h2 style={{ fontSize: ".68rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.accent, margin: 0, marginBottom: ".3rem" }}>{title}</h2>
      <p style={{ fontSize: ".78rem", color: C.muted, margin: 0 }}>{sub}</p>
    </div>
  );
}

function FilterPill({ label, value, active, onChange }) {
  return (
    <button
      onClick={() => onChange(value)}
      style={{
        background:    active ? C.accent : "transparent",
        border:        `1px solid ${active ? C.accent : C.border}`,
        color:         active ? "#000" : C.dim,
        fontFamily:    "inherit",
        fontSize:      ".7rem",
        fontWeight:    active ? 700 : 400,
        padding:       ".3rem .8rem",
        borderRadius:  50,
        cursor:        "pointer",
        transition:    "all .15s",
        letterSpacing: ".04em",
      }}
    >{label}</button>
  );
}

// Custom Tooltip dla wykresów
const DemoTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a111a", border: `1px solid ${C.border}`, borderRadius: 8, padding: ".8rem 1rem", fontSize: ".72rem" }}>
      <div style={{ color: C.accent, fontWeight: 700, marginBottom: ".4rem" }}>{label} {payload[0]?.payload?.estimated ? "📊 (estymacja)" : ""}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: ".15rem" }}>
          {p.name}: <strong>{p.value?.toLocaleString("pl-PL")}</strong> os.
        </div>
      ))}
    </div>
  );
};

const SalaryTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a111a", border: `1px solid ${C.border}`, borderRadius: 8, padding: ".8rem 1rem", fontSize: ".72rem" }}>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.fill, marginBottom: ".1rem" }}>
          {p.payload?.label ?? p.name}: <strong>{p.value?.toLocaleString("pl-PL")} zł netto</strong>
        </div>
      ))}
    </div>
  );
};

const ScatterTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "#0a111a", border: `1px solid ${C.border}`, borderRadius: 8, padding: ".7rem .9rem", fontSize: ".72rem" }}>
      <div style={{ color: C.accent }}>Doświadczenie: <strong>{d?.exp} lat</strong></div>
      <div style={{ color: C.dim }}>Zarobki: <strong style={{ color: "#e8f4ff" }}>{d?.salary?.toLocaleString("pl-PL")} zł</strong></div>
    </div>
  );
};

// ── Heatmapa zarobków (spec × zawód) ──────────────────────
function SalaryHeatmap() {
  const specs = Object.keys(SPEC_MULTIPLIERS);
  const types = [
    { key: "radca",    label: "Radca" },
    { key: "adwokat",  label: "Adwokat" },
    { key: "aplikant", label: "Aplikant" },
  ];
  const BASE = { radca: 10500, adwokat: 9800, aplikant: 4000 };
  const maxVal = Math.max(...specs.flatMap(s => types.map(t => Math.round(BASE[t.key] * SPEC_MULTIPLIERS[s]))));
  const minVal = Math.min(...specs.flatMap(s => types.map(t => Math.round(BASE[t.key] * SPEC_MULTIPLIERS[s]))));

  function heatColor(val) {
    const pct = (val - minVal) / (maxVal - minVal);
    const r = Math.round(pct * 0 + (1 - pct) * 30);
    const g = Math.round(pct * 212 + (1 - pct) * 100);
    const b = Math.round(pct * 255 + (1 - pct) * 100);
    return `rgba(${r},${g},${b},${0.3 + pct * 0.6})`;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: ".72rem" }}>
        <thead>
          <tr>
            <th style={{ padding: ".5rem .8rem", textAlign: "left", color: C.muted, fontWeight: 400, letterSpacing: ".08em" }}>Specjalizacja</th>
            {types.map(t => (
              <th key={t.key} style={{ padding: ".5rem .8rem", color: C.accent, fontWeight: 600, letterSpacing: ".08em" }}>{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {specs.map(spec => (
            <tr key={spec}>
              <td style={{ padding: ".5rem .8rem", color: C.dim, borderTop: `1px solid ${C.border}` }}>{spec}</td>
              {types.map(t => {
                const val = Math.round(BASE[t.key] * SPEC_MULTIPLIERS[spec]);
                return (
                  <td key={t.key} style={{
                    padding: ".5rem .8rem",
                    background: heatColor(val),
                    borderTop: `1px solid ${C.border}`,
                    color: "#e8f4ff",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRadius: 4,
                  }}>
                    {val.toLocaleString("pl-PL")} zł
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: ".6rem", color: C.muted, marginTop: ".6rem" }}>
        Wartości netto · ciemniejszy = niższe, jaśniejszy/zielony = wyższe zarobki
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function AnalizaRynkuPrawniczego() {
  const [demoData,  setDemoData]  = useState(null);
  const [salData,   setSalData]   = useState(null);
  const [scatData,  setScatData]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("demografia");

  // Filtry
  const [fGender, setFGender] = useState("all");
  const [fAge,    setFAge]    = useState("all");
  const [fSpec,   setFSpec]   = useState("all");

  const GENDERS = [
    { label: "Wszyscy",    value: "all" },
    { label: "Kobiety",    value: "kobieta" },
    { label: "Mężczyźni",  value: "mezczyzna" },
  ];
  const AGES = [
    { label: "Wszystkie", value: "all" },
    { label: "25–34",     value: "25-34" },
    { label: "35–44",     value: "35-44" },
    { label: "45–54",     value: "45-54" },
    { label: "55+",       value: "55+" },
  ];
  const SPECS = [
    { label: "Wszystkie",    value: "all" },
    ...Object.keys(SPEC_MULTIPLIERS).map(s => ({ label: s, value: s })),
  ];

  // Załaduj dane demograficzne
  useEffect(() => {
    fetchDemographicsFromMS().then(d => setDemoData(d));
  }, []);

  // Załaduj dane finansowe przy zmianie filtrów
  const loadSalaries = useCallback(async () => {
    setLoading(true);
    const filters = { gender: fGender, age: fAge, spec: fSpec };
    const [kirp, nra] = await Promise.all([
      fetchSalariesFromKIRP(filters),
      fetchSalariesFromNRA(filters),
    ]);
    // Deduplikuj i połącz
    const merged = [...kirp, ...nra.filter(n => !kirp.find(k => k.type === n.type))];
    setSalData(merged);
    setScatData(generateScatterData(filters));
    setLoading(false);
  }, [fGender, fAge, fSpec]);

  useEffect(() => { loadSalaries(); }, [loadSalaries]);

  if (!demoData) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontFamily: "'IBM Plex Mono', monospace" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem", animation: "spin 1s linear infinite" }}>⚖</div>
          Ładowanie danych rynku prawniczego…
        </div>
      </div>
    );
  }

  const totals = demoData.totals;
  const allNow = Object.values(totals).reduce((s, v) => s + v, 0);
  const mediana = 9200;

  return (
    <div style={{
      background:  C.bg,
      minHeight:   "100vh",
      fontFamily:  "'IBM Plex Mono', 'Courier New', monospace",
      color:       C.text,
      padding:     "2rem 1.5rem 4rem",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp .4s ease forwards; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          paddingBottom: "1.2rem",
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <div>
            <div style={{ fontSize: ".6rem", letterSpacing: ".2em", color: C.muted, textTransform: "uppercase", marginBottom: ".3rem" }}>
              Dashboard Analityczny · Sektor Prawniczy
            </div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#e8f4ff", margin: 0, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Analiza Rynku Prawniczego <span style={{ color: C.accent }}>PL</span>
            </h1>
          </div>
          <div style={{ textAlign: "right", fontSize: ".65rem", color: C.muted, lineHeight: 1.6 }}>
            <div style={{ color: C.accent, fontWeight: 600, marginBottom: ".2rem" }}>
              ● DANE MOCK · {new Date().toLocaleDateString("pl-PL")}
            </div>
            Źródła: MS · KIRP · NRA · GUS<br/>
            Prognoza: CAGR (2014–2024 → +5 lat)
          </div>
        </div>

        {/* ── KPI CARDS ─────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }} className="fade-up">
          <KPICard icon="⚖️" label="Radcowie Prawni (2024)" color={C.radca}
            value={totals.radcowie.toLocaleString("pl-PL")}
            sub="Aktywni członkowie KIRP"
            trend={demoData.cagr.radcowie * 100}
          />
          <KPICard icon="🏛️" label="Adwokaci (2024)" color={C.adwokat}
            value={totals.adwokaci.toLocaleString("pl-PL")}
            sub="Aktywni członkowie NRA"
            trend={demoData.cagr.adwokaci * 100}
          />
          <KPICard icon="📈" label="Prognoza radców (2029)" color={C.est}
            value={demoData.projectedIn5y.radcowie.toLocaleString("pl-PL")}
            sub={`+${Math.round((demoData.projectedIn5y.radcowie / totals.radcowie - 1) * 100)}% vs 2024`}
          />
          <KPICard icon="💼" label="Mediana zarobków branży" color={C.apR}
            value={`${mediana.toLocaleString("pl-PL")} zł`}
            sub="Netto · radcowie/adwokaci 35–44 l."
          />
          <KPICard icon="👥" label="Wszyscy prawnicy (2024)" color={C.apA}
            value={allNow.toLocaleString("pl-PL")}
            sub="Radcowie + adwokaci + aplikanci"
          />
        </div>

        {/* ── TABS ──────────────────────────────────────── */}
        <div style={{ display: "flex", gap: ".5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {[
            { id: "demografia", label: "📊 Demografia & Trendy" },
            { id: "finanse",    label: "💰 Analiza Finansowa" },
            { id: "heatmapa",   label: "🌡️ Heatmapa Zarobków" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background:  activeTab === tab.id ? C.accent : "transparent",
              border:      `1px solid ${activeTab === tab.id ? C.accent : C.border}`,
              color:       activeTab === tab.id ? "#000" : C.dim,
              fontFamily:  "inherit",
              fontSize:    ".75rem",
              fontWeight:  activeTab === tab.id ? 700 : 400,
              padding:     ".45rem 1.1rem",
              borderRadius: 8,
              cursor:      "pointer",
              transition:  "all .15s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 1 — DEMOGRAFIA
        ══════════════════════════════════════════════════ */}
        {activeTab === "demografia" && (
          <div className="fade-up">
            <SectionHeader
              title="Liczebność zawodów prawniczych · 2014–2024 (hist.) + 2025–2029 (CAGR)"
              sub="Przerywana linia = prognoza · Pełna linia = dane historyczne z MS/KIRP/NRA"
            />

            {/* Legenda CAGR */}
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              {[
                { label: "Radcowie Prawni", color: C.radca,   cagr: demoData.cagr.radcowie },
                { label: "Adwokaci",        color: C.adwokat, cagr: demoData.cagr.adwokaci },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: ".5rem", fontSize: ".68rem" }}>
                  <div style={{ width: 24, height: 2, background: s.color, borderRadius: 1 }}/>
                  <span style={{ color: s.color }}>{s.label}</span>
                  <span style={{ color: s.cagr > 0 ? "#00ff9f" : "#ff6b6b", marginLeft: ".2rem" }}>
                    CAGR {(s.cagr * 100).toFixed(1)}%/rok
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.5rem" }}>
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={demoData.data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <defs>
                    {[
                      { id: "gR", color: C.radca },
                      { id: "gA", color: C.adwokat },
                      { id: "gAR",color: C.apR },
                      { id: "gAA",color: C.apA },
                    ].map(g => (
                      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={g.color} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={g.color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }}/>
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                  <Tooltip content={<DemoTooltip />}/>
                  <Legend wrapperStyle={{ fontSize: ".7rem", color: C.dim }}/>
                  <ReferenceLine x={2024} stroke={C.est} strokeDasharray="4 2"
                    label={{ value: "→ prognoza", fill: C.est, fontSize: 11, position: "insideTopRight" }}/>

                  {/* Historyczne — pełna linia */}
                  {[
                    { key: "radcowie",    name: "Radcowie Prawni",      color: C.radca,   grad: "gR" },
                    { key: "adwokaci",    name: "Adwokaci",             color: C.adwokat, grad: "gA" },
                    { key: "apRradcowscy",name: "Aplikanci Radcowscy",  color: C.apR,     grad: "gAR" },
                    { key: "apAdwokaccy", name: "Aplikanci Adwokaccy",  color: C.apA,     grad: "gAA" },
                  ].map(s => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.name}
                      stroke={s.color} fill={`url(#${s.grad})`} strokeWidth={2}
                      dot={false} activeDot={{ r: 4, fill: s.color }}
                      strokeDasharray={undefined}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ fontSize: ".62rem", color: C.muted, marginTop: ".5rem", textAlign: "center" }}>
                Obszar szary po roku 2024 = estymacja CAGR · dane historyczne: MS / KIRP / NRA (mock)
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2 — ANALIZA FINANSOWA
        ══════════════════════════════════════════════════ */}
        {activeTab === "finanse" && (
          <div className="fade-up">
            <SectionHeader
              title="Zarobki w zawodach prawniczych"
              sub="Średnie miesięczne wynagrodzenie netto (PLN) · filtruj poniżej"
            />

            {/* Filtry */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "1rem 1.2rem", marginBottom: "1.5rem",
              display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: ".6rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: ".4rem" }}>Płeć</div>
                <div style={{ display: "flex", gap: ".4rem" }}>
                  {GENDERS.map(g => <FilterPill key={g.value} label={g.label} value={g.value} active={fGender === g.value} onChange={setFGender}/>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: ".6rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: ".4rem" }}>Wiek</div>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                  {AGES.map(a => <FilterPill key={a.value} label={a.label} value={a.value} active={fAge === a.value} onChange={setFAge}/>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: ".6rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: ".4rem" }}>Specjalizacja</div>
                <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                  {SPECS.map(s => <FilterPill key={s.value} label={s.label} value={s.value} active={fSpec === s.value} onChange={setFSpec}/>)}
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: ".8rem" }}>
                Pobieranie danych z KIRP / NRA API…
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>

                {/* Wykres słupkowy — śr. zarobki */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.3rem", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: ".65rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "1rem" }}>
                    Średnie wynagrodzenie netto wg zawodu
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={salData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 12 }} axisLine={{ stroke: C.border }}/>
                      <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }}
                        tickFormatter={v => `${v.toLocaleString("pl-PL")} zł`}/>
                      <Tooltip content={<SalaryTooltip />}/>
                      <Bar dataKey="avg" radius={[6,6,0,0]} name="Śr. zarobki netto">
                        {salData?.map((entry, i) => (
                          <Cell key={i} fill={[C.radca, C.adwokat, C.apR][i % 3]}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Scatter — doświadczenie vs zarobki */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.3rem" }}>
                  <div style={{ fontSize: ".65rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "1rem" }}>
                    Doświadczenie vs zarobki netto
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="exp" name="Lata doświadczenia" type="number"
                        tick={{ fill: C.muted, fontSize: 10 }} label={{ value: "Lata dośw.", position: "insideBottom", fill: C.muted, fontSize: 10, offset: -3 }}
                        axisLine={{ stroke: C.border }}/>
                      <YAxis dataKey="salary" name="Zarobki netto" type="number"
                        tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }}
                        tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<ScatterTooltip />}/>
                      <Scatter data={scatData} fill={C.accent} fillOpacity={0.6} name="Prawnik"/>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                {/* Zarobki wg specjalizacji */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.3rem" }}>
                  <div style={{ fontSize: ".65rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "1rem" }}>
                    Mnożnik zarobków wg specjalizacji
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      layout="vertical"
                      data={Object.entries(SPEC_MULTIPLIERS).map(([spec, mult]) => ({ spec, mult: +((mult - 1) * 100).toFixed(0) }))}
                      margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }}
                        tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`}/>
                      <YAxis type="category" dataKey="spec" tick={{ fill: C.dim, fontSize: 10 }} width={90} axisLine={{ stroke: C.border }}/>
                      <Tooltip formatter={(v) => [`${v > 0 ? "+" : ""}${v}% vs avg`, "Premia"]}/>
                      <ReferenceLine x={0} stroke={C.border}/>
                      <Bar dataKey="mult" radius={[0,4,4,0]}>
                        {Object.entries(SPEC_MULTIPLIERS).map(([spec, m], i) => (
                          <Cell key={spec} fill={m >= 1.1 ? C.radca : m >= 1 ? C.apA : C.adwokat} fillOpacity={0.8}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3 — HEATMAPA
        ══════════════════════════════════════════════════ */}
        {activeTab === "heatmapa" && (
          <div className="fade-up">
            <SectionHeader
              title="Heatmapa zarobków netto · Specjalizacja × Zawód"
              sub="Średnie wynagrodzenie netto (PLN/mies.) — kolor = intensywność zarobków"
            />
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>
              <SalaryHeatmap />
            </div>

            {/* Mini statystyki gender gap */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: ".65rem", color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: "1rem" }}>
                Gender gap w zarobkach · radcowie prawni (netto PLN)
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={["25-34","35-44","45-54","55+"].map(age => ({
                    age,
                    kobieta:   SALARY_BASE.radca.kobieta[age],
                    mezczyzna: SALARY_BASE.radca.mezczyzna[age],
                    luka:      SALARY_BASE.radca.mezczyzna[age] - SALARY_BASE.radca.kobieta[age],
                  }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="age" tick={{ fill: C.dim, fontSize: 11 }} axisLine={{ stroke: C.border }}/>
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }}
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={v => [`${v.toLocaleString("pl-PL")} zł`, ""]}/>
                  <Legend wrapperStyle={{ fontSize: ".7rem" }}/>
                  <Bar dataKey="kobieta"   name="Kobiety"    fill={C.apA}    radius={[4,4,0,0]} fillOpacity={0.85}/>
                  <Bar dataKey="mezczyzna" name="Mężczyźni"  fill={C.radca}  radius={[4,4,0,0]} fillOpacity={0.85}/>
                  <Bar dataKey="luka"      name="Luka (M-K)" fill={C.adwokat} radius={[4,4,0,0]} fillOpacity={0.7}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── FOOTER ──────────────────────────────────── */}
        <div style={{ marginTop: "3rem", borderTop: `1px solid ${C.border}`, paddingTop: "1rem", fontSize: ".62rem", color: C.muted, lineHeight: 1.8 }}>
          <strong style={{ color: C.dim }}>⚠️ Dane mockowe</strong> — komponent gotowy do podpięcia pod API MS ({API_CONFIG.MS_BASE}), KIRP ({API_CONFIG.KIRP_BASE}), NRA ({API_CONFIG.NRA_BASE}).
          Prognoza oparta na CAGR z lat 2014–2024. Gender gap szacunkowy na podstawie GUS „Rozkład wynagrodzeń" 2024.
        </div>
      </div>
    </div>
  );
}
