"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import { Trees, Map, TrendingDown, TrendingUp, Minus, Activity, Calendar, Layers } from "lucide-react";

interface YearlyPoint { year: number; avg_ndvi: number; avg_cover: number; avg_disturbance: number }
interface VegetationData {
  zone_name: string; state: string;
  yearly: YearlyPoint[];
  summary: { first_year: number; last_year: number; first_ndvi: number; last_ndvi: number; ndvi_change: number; cover_change_pct: number; trend: string };
}
interface Zone { id: number; name: string; type: string; }

const ZoneMap = dynamic(() => import("@/components/map/NDVIMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-100"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>,
});

export default function DeforestationPage() {
  const { isAuthenticated, isLoading, getHeaders } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [data, setData] = useState<VegetationData | null>(null);
  const [dl, setDl] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => { if (!isLoading && !isAuthenticated) router.push("/login"); }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(api("/api/v1/deforestation/zones"), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((z: Zone[]) => { setZones(z); if (z.length > 0) setZoneId(z[0].id); });
  }, [isAuthenticated, getHeaders]);

  useEffect(() => {
    if (!zoneId) return;
    setDl(true);
    fetch(api(`/api/v1/deforestation/${zoneId}`), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setDl(false); if (d) setSelectedYear(d.summary.last_year); });
  }, [zoneId, getHeaders]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  const yearly = data?.yearly || [];
  const ndviRange = yearly.length > 0
    ? { min: Math.min(...yearly.map((p) => p.avg_ndvi)), max: Math.max(...yearly.map((p) => p.avg_ndvi)) }
    : { min: 0, max: 1 };
  const rangePad = (ndviRange.max - ndviRange.min) * 0.15;
  const chartH = 200; const chartW = 660;
  const pad = { top: 10, right: 15, bottom: 28, left: 48 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;

  const getXY = (p: YearlyPoint, idx: number) => {
    const x = pad.left + (idx / (yearly.length - 1)) * plotW;
    const y = pad.top + plotH * (1 - (p.avg_ndvi - ndviRange.min + rangePad) / (ndviRange.max - ndviRange.min + 2 * rangePad));
    return { x, y };
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="w-[340px] shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2"><Trees className="h-5 w-5 text-emerald-600" /><h1 className="text-[18px] font-bold text-slate-900">Deforestation Monitor</h1></div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">Click a year on the chart to explore satellite imagery for that period. Compare vegetation health across decades.</p>
        </motion.div>

        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Select Zone</p>
          {zones.map((z) => (
            <button key={z.id} onClick={() => setZoneId(z.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-[13px] mb-1 ${zoneId === z.id ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "text-slate-600 hover:bg-emerald-50"}`}>
              <Map className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate flex-1">{z.name}</span>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${zoneId === z.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>{z.type.replace("_", " ")}</span>
            </button>
          ))}
        </div>

        {data && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">NDVI Change</p>
                <p className="mt-1 text-[20px] font-black tabular-nums text-red-600">{data.summary.ndvi_change < 0 ? data.summary.ndvi_change.toFixed(3) : "+" + data.summary.ndvi_change.toFixed(3)}</p>
                <p className="text-[10px] text-red-400">{data.summary.first_year}→{data.summary.last_year}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Cover Loss</p>
                <p className="mt-1 text-[20px] font-black tabular-nums text-amber-700">{Math.abs(data.summary.cover_change_pct).toFixed(1)}%</p>
                <p className="text-[10px] text-amber-500">forest cover</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                {data.summary.trend === "declining" ? <TrendingDown className="h-4 w-4 text-red-500" /> : data.summary.trend === "improving" ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <Minus className="h-4 w-4 text-amber-500" />}
                <span className="text-[13px] font-bold text-slate-700 capitalize">{data.summary.trend}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">NDVI: {data.summary.first_ndvi.toFixed(3)} → {data.summary.last_ndvi.toFixed(3)}</p>
            </div>

            {selectedYear && data.yearly.find((p) => p.year === selectedYear) && (
              <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 ring-1 ring-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Selected Year</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <span className="text-[20px] font-black tabular-nums text-emerald-700">{selectedYear}</span>
                </div>
                {(() => {
                  const pt = data.yearly.find((p) => p.year === selectedYear)!;
                  const pct = data.yearly[0].avg_ndvi > 0 ? ((pt.avg_ndvi - data.yearly[0].avg_ndvi) / data.yearly[0].avg_ndvi) * 100 : 0;
                  return (
                    <div className="mt-1 grid grid-cols-2 gap-x-3 text-[11px]">
                      <span className="text-slate-500">NDVI: <strong className="text-slate-700">{pt.avg_ndvi.toFixed(4)}</strong></span>
                      <span className="text-slate-500">Change: <strong className={pct < 0 ? "text-red-600" : "text-emerald-600"}>{pct.toFixed(1)}%</strong></span>
                      <span className="text-slate-500">Cover: <strong className="text-slate-700">{pt.avg_cover.toFixed(1)}%</strong></span>
                      <span className="text-slate-500">Disturb: <strong className="text-slate-700">{pt.avg_disturbance.toFixed(1)}%</strong></span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Interpretation</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong>NDVI</strong> (Normalized Difference Vegetation Index) ranges from -1 to 1. Higher values indicate healthier, denser vegetation. Declining NDVI over time suggests forest degradation or deforestation.
              </p>
            </div>
          </>
        )}
      </aside>

      {/* Main — Map + Chart */}
      <main className="flex-1 flex flex-col bg-white">
        {dl && <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}

        {!dl && data && (
          <>
            {/* Satellite Map */}
            <div className="h-[55%] relative border-b border-slate-200">
              <ZoneMap year={selectedYear} zoneId={zoneId} side="left" onYearChange={() => {}} />
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur px-3 py-1.5 shadow-lg ring-1 ring-slate-200">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[12px] font-bold text-slate-700">{selectedYear} Satellite</span>
              </div>
            </div>

            {/* Chart */}
            <div className="border-b border-slate-200 bg-[#F8FAFC] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[12px] font-bold text-slate-700">{data.zone_name}</span>
                <span className="text-[11px] text-slate-400">{data.summary.first_year}–{data.summary.last_year}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">Click chart points to explore years</span>
                <button onClick={() => setSelectedYear(data.summary.first_year)} className="text-[11px] font-medium text-slate-500 hover:text-emerald-600">Reset</button>
                <button onClick={() => setSelectedYear(data.summary.last_year)} className="text-[11px] font-medium text-slate-500 hover:text-emerald-600">Latest</button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-[#F8FAFC]">
              <svg ref={chartRef} viewBox={`0 0 ${chartW} ${chartH}`} width={chartW} height={chartH} className="max-w-full cursor-pointer">
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const val = ndviRange.min + (ndviRange.max - ndviRange.min) * frac;
                  const y = pad.top + plotH * (1 - (val - ndviRange.min + rangePad) / (ndviRange.max - ndviRange.min + 2 * rangePad));
                  return (
                    <g key={frac}>
                      <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#E2E8F0" strokeWidth={0.5} />
                      <text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize={9}>{val.toFixed(3)}</text>
                    </g>
                  );
                })}
                {yearly.filter((_, i) => i % 3 === 0).map((p) => {
                  const { x } = getXY(p, yearly.indexOf(p));
                  return <text key={p.year} x={x} y={chartH - 5} textAnchor="middle" fill="#94A3B8" fontSize={10}>{p.year}</text>;
                })}
                <polyline fill="none" stroke="#16A34A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  points={yearly.map((p, i) => { const { x, y } = getXY(p, i); return `${x},${y}`; }).join(" ")}
                />
                <polygon fill="#FEE2E2" fillOpacity={0.35}
                  points={
                    yearly.map((p, i) => { const { x, y } = getXY(p, i); return `${x},${y}`; }).join(" ") +
                    ` ${pad.left + plotW},${pad.top + plotH} ${pad.left},${pad.top + plotH}`
                  }
                />
                {yearly.map((p, i) => {
                  const { x, y } = getXY(p, i);
                  const isSelected = p.year === selectedYear;
                  const pctChange = yearly[0].avg_ndvi > 0 ? ((p.avg_ndvi - yearly[0].avg_ndvi) / yearly[0].avg_ndvi) * 100 : 0;
                  return (
                    <g key={p.year} onClick={() => setSelectedYear(p.year)} style={{ cursor: "pointer" }}>
                      {isSelected && <circle cx={x} cy={y} r={14} fill="none" stroke="#16A34A" strokeWidth={2} opacity={0.3} />}
                      <circle cx={x} cy={y} r={isSelected ? 5 : 3} fill={isSelected ? "#059669" : "#16A34A"} stroke="white" strokeWidth={isSelected ? 2 : 1.5} />
                      {isSelected && (
                        <>
                          <text x={x} y={y - 16} textAnchor="middle" fill="#059669" fontSize={11} fontWeight="bold">{p.avg_ndvi.toFixed(4)}</text>
                          <text x={x} y={y + 20} textAnchor="middle" fill={pctChange < 0 ? "#DC2626" : "#059669"} fontSize={10} fontWeight="bold">{pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%</text>
                        </>
                      )}
                      {!isSelected && i % 4 === 0 && (
                        <text x={x} y={y - 10} textAnchor="middle" fill="#16A34A" fontSize={9}>{p.avg_ndvi.toFixed(3)}</text>
                      )}
                    </g>
                  );
                })}
                {/* Selected year vertical line */}
                {yearly.find((p) => p.year === selectedYear) && (() => {
                  const pt = yearly.find((p) => p.year === selectedYear)!;
                  const { x, y } = getXY(pt, yearly.indexOf(pt));
                  return <line x1={x} y1={y} x2={x} y2={pad.top + plotH} stroke="#16A34A" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />;
                })()}
              </svg>
            </div>
          </>
        )}

        {!dl && !data && zoneId && (
          <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] text-slate-400">No vegetation data available for this zone yet.</div>
        )}
      </main>
    </div>
  );
}
