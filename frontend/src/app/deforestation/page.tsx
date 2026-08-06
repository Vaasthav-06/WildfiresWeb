"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import { Trees, Map, TrendingDown, TrendingUp, Minus, Activity, BarChart3 } from "lucide-react";

interface YearlyPoint { year: number; avg_ndvi: number; avg_cover: number; avg_disturbance: number }
interface VegetationData {
  zone_name: string; state: string;
  yearly: YearlyPoint[];
  summary: { first_year: number; last_year: number; first_ndvi: number; last_ndvi: number; ndvi_change: number; cover_change_pct: number; trend: string };
}

interface Zone { id: number; name: string; type: string; }

const ZoneMap = dynamic(() => import("@/components/map/NDVIMap"), { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-800"><div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div> });

export default function DeforestationPage() {
  const { isAuthenticated, isLoading, getHeaders } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [data, setData] = useState<VegetationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(api("/api/v1/deforestation/zones"), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((z: Zone[]) => {
        setZones(z);
        if (z.length > 0) setZoneId(z[0].id);
      });
  }, [isAuthenticated, getHeaders]);

  useEffect(() => {
    if (!zoneId) return;
    setLoading(true);
    fetch(api(`/api/v1/deforestation/${zoneId}`), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }, [zoneId, getHeaders]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  const yearly = data?.yearly || [];
  const ndviRange = yearly.length > 0 ? { min: Math.min(...yearly.map((p) => p.avg_ndvi)), max: Math.max(...yearly.map((p) => p.avg_ndvi)) } : { min: 0, max: 1 };
  const chartW = 600; const chartH = 220;
  const pad = { top: 10, right: 20, bottom: 30, left: 50 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      <aside className="w-[380px] shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2"><Trees className="h-5 w-5 text-emerald-600" /><h1 className="text-[18px] font-bold text-slate-900">Deforestation Monitor</h1></div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">Vegetation health trends across protected reserves using satellite-derived vegetation indices. Track forest cover change from 2005–2025.</p>
        </motion.div>

        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Select Reserve</p>
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
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">NDVI Change</p>
                <p className="mt-1 text-[22px] font-black tabular-nums text-red-600">{data.summary.ndvi_change < 0 ? data.summary.ndvi_change.toFixed(3) : "+" + data.summary.ndvi_change.toFixed(3)}</p>
                <p className="text-[10px] text-red-400">{data.summary.first_year} → {data.summary.last_year}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Cover Loss</p>
                <p className="mt-1 text-[22px] font-black tabular-nums text-amber-700">{Math.abs(data.summary.cover_change_pct).toFixed(1)}%</p>
                <p className="text-[10px] text-amber-500">forest cover lost</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Trend</p>
              <div className="flex items-center gap-2">
                {data.summary.trend === "declining" ? <TrendingDown className="h-5 w-5 text-red-500" /> : data.summary.trend === "improving" ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <Minus className="h-5 w-5 text-amber-500" />}
                <span className="text-[14px] font-bold text-slate-700 capitalize">{data.summary.trend}</span>
              </div>
              <p className="mt-1 text-[12px] text-slate-500">NDVI from {data.summary.first_ndvi.toFixed(3)} → {data.summary.last_ndvi.toFixed(3)}</p>
            </div>
          </>
        )}
      </aside>

      <main className="flex-1 flex flex-col bg-white">
        {loading && <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}

        {!loading && data && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-600" /><h2 className="text-[14px] font-bold text-slate-900">{data.zone_name} — Vegetation Trend ({data.summary.first_year}–{data.summary.last_year})</h2></div>
              <p className="text-[12px] text-slate-500 mt-0.5">{data.state} · {Math.abs(data.summary.ndvi_change * 100).toFixed(1)}% NDVI change over {data.summary.last_year - data.summary.first_year} years</p>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto p-6 bg-[#F8FAFC]">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} width={chartW} height={chartH} className="max-w-full">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const y = pad.top + plotH * (1 - frac);
                  const val = ndviRange.min + (ndviRange.max - ndviRange.min) * frac;
                  return (
                    <g key={frac}>
                      <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#E2E8F0" strokeWidth={0.5} />
                      <text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize={10}>{val.toFixed(2)}</text>
                    </g>
                  );
                })}
                {/* X labels */}
                {yearly.filter((_, i) => i % 3 === 0).map((p) => {
                  const x = pad.left + ((p.year - yearly[0].year) / (yearly.length - 1)) * plotW;
                  return <text key={p.year} x={x} y={chartH - 8} textAnchor="middle" fill="#94A3B8" fontSize={10}>{p.year}</text>;
                })}
                {/* NDVI Line */}
                <polyline
                  fill="none" stroke="#16A34A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  points={yearly.map((p, i) => {
                    const x = pad.left + (i / (yearly.length - 1)) * plotW;
                    const y = pad.top + plotH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min));
                    return `${x},${y}`;
                  }).join(" ")}
                />
                {/* Declining area fill */}
                <polygon
                  fill="#FEE2E2" fillOpacity={0.4}
                  points={
                    yearly.map((p, i) => {
                      const x = pad.left + (i / (yearly.length - 1)) * plotW;
                      const y = pad.top + plotH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min));
                      return `${x},${y}`;
                    }).join(" ") +
                    ` ${pad.left + plotW},${pad.top + plotH} ${pad.left},${pad.top + plotH}`
                  }
                />
                {/* Data points with % change labels */}
                {yearly.map((p, i) => {
                  const x = pad.left + (i / (yearly.length - 1)) * plotW;
                  const y = pad.top + plotH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min));
                  const pctChange = yearly[0].avg_ndvi > 0 ? ((p.avg_ndvi - yearly[0].avg_ndvi) / yearly[0].avg_ndvi) * 100 : 0;
                  return (
                    <g key={p.year}>
                      <circle cx={x} cy={y} r={3} fill="#16A34A" stroke="white" strokeWidth={1.5} />
                      {i % 4 === 0 && (
                        <>
                          <text x={x} y={y - 12} textAnchor="middle" fill="#16A34A" fontSize={9} fontWeight="bold">{p.avg_ndvi.toFixed(3)}</text>
                          <text x={x} y={y + 16} textAnchor="middle" fill={pctChange < 0 ? "#DC2626" : "#16A34A"} fontSize={9} fontWeight="bold">{pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%</text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="border-t border-slate-200">
              <ZoneMap year={2025} zoneId={zoneId} side="left" onYearChange={() => {}} />
            </div>
          </div>
        )}

        {!loading && !data && zoneId && (
          <div className="flex flex-1 items-center justify-center bg-[#F8FAFC] text-slate-400">No vegetation data available for this zone yet.</div>
        )}
      </main>
    </div>
  );
}
