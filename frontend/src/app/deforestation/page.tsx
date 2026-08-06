"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, TrendingUp, Minus, Trees, Square, Activity, Crosshair } from "lucide-react";

const DeforestationMapInner = dynamic(() => import("@/components/map/DeforestationMap"), { ssr: false });

interface ZoneFeature { id: number; name: string; type: string; state?: string; geojson: string; ndvi_change: number; cover_change: number; trend: string; color: string }
interface YearlyPoint { year: number; avg_ndvi: number; avg_cover: number; avg_disturbance: number }
interface ZoneDetail {
  zone_name: string; zone_type: string; area_sq_deg?: number; intersected_zones?: number;
  intersected_names?: string[]; yearly: YearlyPoint[]; sea_body?: boolean;
  summary: { first_year: number; last_year: number; first_ndvi: number; last_ndvi: number; ndvi_change: number; cover_change_pct: number; trend: string };
}

const CHART_COLORS: Record<string, string> = { declining: "#DC2626", stable: "#F59E0B", improving: "#16A34A" };

function TrendBadge({ trend, change }: { trend: string; change: number }) {
  const cfg = trend === "declining" ? { icon: TrendingDown, color: "bg-red-50 text-red-700 border-red-200" }
    : trend === "improving" ? { icon: TrendingUp, color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : { icon: Minus, color: "bg-amber-50 text-amber-700 border-amber-200" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
      <cfg.icon className="h-3 w-3" />
      {trend} ({change > 0 ? "+" : ""}{change.toFixed(1)}%)
    </span>
  );
}

export default function DeforestationPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [selected, setSelected] = useState<ZoneFeature | null>(null);
  const [detail, setDetail] = useState<ZoneDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [hasRect, setHasRect] = useState(false);

  const toggleDraw = useCallback(() => {
    setDrawMode((prev) => {
      if (!prev) { setSelected(null); setDetail(null); }
      return !prev;
    });
  }, []);

  useEffect(() => { if (!isLoading && !isAuthenticated) router.push("/login"); }, [isLoading, isAuthenticated, router]);

  const onRectDraw = useCallback(async (swLat: number, swLng: number, neLat: number, neLng: number, token: string) => {
    setHasRect(true);
    setSelected(null);
    setDLoading(true);
    setDetail(null);
    try {
      const r = await fetch(api("/api/v1/deforestation/analyze-area"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat1: swLat, lon1: swLng, lat2: neLat, lon2: neLng }),
      });
      if (r.ok) {
        const d = await r.json();
        setDetail(d);
        setSelected({ id: 0, name: d.zone_name, type: d.zone_type, geojson: "", ndvi_change: d.summary.ndvi_change, cover_change: d.summary.cover_change_pct, trend: d.summary.trend, color: CHART_COLORS[d.summary.trend] || "#94A3B8" });
      }
    } catch {} finally { setDLoading(false); }
  }, []);

  const onZoneClick = useCallback(async (z: ZoneFeature, token: string) => {
    setSelected(z);
    setDLoading(true);
    setDetail(null);
    try {
      const r = await fetch(api(`/api/v1/deforestation/${z.id}`), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setDetail(await r.json());
    } catch {} finally { setDLoading(false); }
  }, []);

  const close = () => { setSelected(null); setDetail(null); };

  if (isLoading || !isAuthenticated) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  const yearly = detail?.yearly || [];
  const ndviRange = yearly.length > 0 ? { min: Math.min(...yearly.map((p) => p.avg_ndvi)), max: Math.max(...yearly.map((p) => p.avg_ndvi)) } : { min: 0, max: 1 };
  const cH = 170; const cW = 380;
  const pad = { t: 8, r: 10, b: 24, l: 42 };
  const pW = cW - pad.l - pad.r; const pH = cH - pad.t - pad.b;

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden">
      <DeforestationMapInner
        onZonesLoaded={setFeatures}
        onZoneClick={onZoneClick}
        onRectDraw={onRectDraw}
        drawMode={drawMode}
        onDrawEnd={() => setDrawMode(false)}
      />

      {/* Legend + Draw button */}
      <div className="absolute top-4 left-4 z-10 rounded-xl bg-white/90 backdrop-blur px-4 py-3 shadow-lg ring-1 ring-slate-200/80">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Vegetation Trend</p>
        {[{ label: "Declining", color: "#DC2626" }, { label: "Stable", color: "#F59E0B" }, { label: "Improving", color: "#16A34A" }].map((t) => (
          <div key={t.label} className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            <span className="text-[12px] text-slate-600">{t.label}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">{features.length} zones</div>
      </div>

      {/* Draw tool button */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <div className="rounded-xl bg-white/90 backdrop-blur px-4 py-2.5 shadow-lg ring-1 ring-slate-200/80 flex items-center gap-2">
          <Trees className="h-4 w-4 text-emerald-600" />
          <span className="text-[12px] font-bold text-slate-700">Deforestation Monitor</span>
          <span className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={toggleDraw}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold transition-all ${
              drawMode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"
            }`}
          >
            <Square className="h-3.5 w-3.5" />
            {drawMode ? "Drawing..." : "Draw Area"}
          </button>
          {hasRect && (
            <button
              onClick={() => { setHasRect(false); setSelected(null); setDetail(null); }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Draw mode indicator */}
      {drawMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-lg animate-pulse">
          <Crosshair className="inline h-4 w-4 mr-2 -mt-0.5" />
          Click and drag to draw analysis rectangle
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 z-20 h-full w-[420px] overflow-y-auto bg-white shadow-2xl border-l border-slate-200"
          >
            <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold text-slate-900 truncate">{selected.name}</h2>
                <p className="text-[11px] text-slate-500">{selected.type.replace(/_/g, " ")} {detail?.intersected_zones ? `· ${detail.intersected_zones} zones` : `· ${selected.state || ""}`}</p>
              </div>
              <button onClick={close} className="text-slate-400 hover:text-slate-600 ml-3"><X className="h-5 w-5" /></button>
            </div>

            {dLoading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}

            {detail && detail.sea_body && (
              <div className="p-5 flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-blue-50 p-4 mb-4">
                  <svg className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-bold text-slate-700 mb-1">Sea / Ocean Body</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">
                  Vegetation analysis is not available for ocean areas. Please draw a rectangle over land to see deforestation trends.
                </p>
              </div>
            )}

            {detail && !detail.sea_body && !dLoading && (
              <div className="p-5 space-y-4">
                {detail.intersected_names && detail.intersected_names.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {detail.intersected_names.map((n) => <span key={n} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{n}</span>)}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <TrendBadge trend={detail.summary.trend} change={detail.summary.ndvi_change * 100} />
                  {detail.area_sq_deg && <span className="text-[10px] text-slate-400">{detail.area_sq_deg.toFixed(2)}deg²</span>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">{detail.summary.first_year}</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-slate-800">{detail.summary.first_ndvi.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">{detail.summary.last_year}</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-slate-800">{detail.summary.last_ndvi.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-red-500">Change</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-red-600">{(detail.summary.ndvi_change * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <svg viewBox={`0 0 ${cW} ${cH}`} width="100%" height={cH}>
                    {[0, 0.33, 0.66, 1].map((frac) => {
                      const val = ndviRange.min + (ndviRange.max - ndviRange.min) * frac;
                      const y = pad.t + pH * (1 - frac);
                      return <g key={frac}><line x1={pad.l} y1={y} x2={pad.l + pW} y2={y} stroke="#E2E8F0" strokeWidth={0.5} /><text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#94A3B8" fontSize={8}>{val.toFixed(3)}</text></g>;
                    })}
                    {yearly.filter((_, i) => i % 4 === 0).map((p) => {
                      const x = pad.l + ((p.year - yearly[0].year) / (yearly.length - 1)) * pW;
                      return <text key={p.year} x={x} y={cH - 4} textAnchor="middle" fill="#94A3B8" fontSize={8}>{p.year}</text>;
                    })}
                    <polygon fill="#FEE2E2" fillOpacity={0.3}
                      points={yearly.map((p, i) => {
                        const x = pad.l + (i / (yearly.length - 1)) * pW;
                        const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                        return `${x},${y}`;
                      }).join(" ") + ` ${pad.l + pW},${pad.t + pH} ${pad.l},${pad.t + pH}`}
                    />
                    <polyline fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round"
                      points={yearly.map((p, i) => {
                        const x = pad.l + (i / (yearly.length - 1)) * pW;
                        const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                        return `${x},${y}`;
                      }).join(" ")}
                    />
                    {yearly.map((p, i) => {
                      const x = pad.l + (i / (yearly.length - 1)) * pW;
                      const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                      return <circle key={p.year} cx={x} cy={y} r={2} fill="#16A34A" stroke="white" strokeWidth={1} />;
                    })}
                  </svg>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3 ring-1 ring-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-[11px] font-bold text-blue-700">Analysis</span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    {detail.summary.trend === "declining"
                      ? `Vegetation declined ${Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}% over ${detail.summary.last_year - detail.summary.first_year} years. Cover loss: ${Math.abs(detail.summary.cover_change_pct).toFixed(1)}%.`
                      : detail.summary.trend === "improving"
                        ? `Improved by ${(detail.summary.ndvi_change * 100).toFixed(1)}% over ${detail.summary.last_year - detail.summary.first_year} years.`
                        : `Relatively stable (±${Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}% NDVI change).`
                    }
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
