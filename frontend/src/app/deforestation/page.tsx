"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, TrendingUp, Minus, Trees, Calendar, Activity } from "lucide-react";

interface ZoneFeature { id: number; name: string; type: string; state?: string; geojson: string; ndvi_change: number; cover_change: number; trend: string; color: string }

interface YearlyPoint { year: number; avg_ndvi: number; avg_cover: number; avg_disturbance: number }
interface ZoneDetail { zone_name: string; zone_type: string; state: string; yearly: YearlyPoint[]; summary: { first_year: number; last_year: number; first_ndvi: number; last_ndvi: number; ndvi_change: number; cover_change_pct: number; trend: string } }

function TrendBadge({ trend, change }: { trend: string; change: number }) {
  const cfg = trend === "declining" ? { icon: TrendingDown, color: "bg-red-50 text-red-700 border-red-200" }
    : trend === "improving" ? { icon: TrendingUp, color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : { icon: Minus, color: "bg-amber-50 text-amber-700 border-amber-200" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
      <cfg.icon className="h-3 w-3" />
      {trend} {change !== 0 && <span className="tabular-nums">({change > 0 ? "+" : ""}{change.toFixed(1)}%)</span>}
    </span>
  );
}

export default function DeforestationPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [selected, setSelected] = useState<ZoneFeature | null>(null);
  const [detail, setDetail] = useState<ZoneDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);

  useEffect(() => { if (!isLoading && !isAuthenticated) router.push("/login"); }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !containerRef.current || mapRef.current) return;
    const token = localStorage.getItem("wf_token") || "";

    const map = L.map(containerRef.current, {
      center: [23.5, 80], zoom: 6,
      zoomControl: true, attributionControl: false,
    });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 19,
    }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OSM", maxZoom: 19, opacity: 0.35,
    }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);
    mapRef.current = map;

    fetch(api("/api/v1/deforestation/map-data"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((zones: ZoneFeature[]) => {
        setFeatures(zones);
        zones.forEach((z) => {
          try {
            const geom = JSON.parse(z.geojson);
            const layer = L.geoJSON(geom as never, {
              style: { color: z.color, weight: 3, fillColor: z.color, fillOpacity: 0.15 },
            });
            layer.bindTooltip(
              `<div style="font-family:Inter;font-size:12px;line-height:1.5;max-width:220px">
                <b style="color:#1E293B;font-size:13px">${z.name}</b><br/>
                <span style="color:#64748B">${z.type.replace(/_/g, " ")} · ${z.state || ""}</span><br/>
                <span style="color:${z.color};font-weight:600">${z.trend} (${z.ndvi_change > 0 ? "+" : ""}${(z.ndvi_change * 100).toFixed(1)}% NDVI)</span>
              </div>`,
              { direction: "top", sticky: true, opacity: 0.95 }
            );
            layer.on("click", () => {
              setSelected(z);
              setDetail(null);
              setDLoading(true);
              fetch(api(`/api/v1/deforestation/${z.id}`), { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => { setDetail(d); setDLoading(false); })
                .catch(() => setDLoading(false));
            });
            layer.addTo(map);
          } catch {}
        });
        if (zones.length > 0) {
          const allBounds = L.latLngBounds([] as never);
          map.eachLayer((l) => { if (l instanceof L.GeoJSON) { try { allBounds.extend((l as L.GeoJSON).getBounds()); } catch {} } });
          if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [40, 40] });
        }
      });

    return () => { map.remove(); mapRef.current = null; };
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  const yearly = detail?.yearly || [];
  const ndviRange = yearly.length > 0 ? { min: Math.min(...yearly.map((p) => p.avg_ndvi)), max: Math.max(...yearly.map((p) => p.avg_ndvi)) } : { min: 0, max: 1 };
  const cH = 160; const cW = 400;
  const pad = { t: 8, r: 10, b: 24, l: 42 };
  const pW = cW - pad.l - pad.r; const pH = cH - pad.t - pad.b;

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Legend overlay */}
      <div className="absolute top-4 left-4 z-10 rounded-xl bg-white/90 backdrop-blur px-4 py-3 shadow-lg ring-1 ring-slate-200/80">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Vegetation Trend</p>
        {[{ label: "Declining", color: "#DC2626" }, { label: "Stable", color: "#F59E0B" }, { label: "Improving", color: "#16A34A" }].map((t) => (
          <div key={t.label} className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            <span className="text-[12px] text-slate-600">{t.label}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          {features.length} zones · Click for details
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-4 right-4 z-10 rounded-xl bg-white/90 backdrop-blur px-4 py-2.5 shadow-lg ring-1 ring-slate-200/80">
        <div className="flex items-center gap-2">
          <Trees className="h-4 w-4 text-emerald-600" />
          <span className="text-[12px] font-bold text-slate-700">Deforestation Monitor</span>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 z-20 h-full w-[420px] overflow-y-auto bg-white shadow-2xl border-l border-slate-200"
          >
            <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">{selected.name}</h2>
                <p className="text-[11px] text-slate-500">{selected.type.replace(/_/g, " ")} · {selected.state || ""}</p>
              </div>
              <button onClick={() => { setSelected(null); setDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {dLoading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}

            {detail && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <TrendBadge trend={detail.summary.trend} change={detail.summary.ndvi_change * 100} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">NDVI {detail.summary.first_year}</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-slate-800">{detail.summary.first_ndvi.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">NDVI {detail.summary.last_year}</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-slate-800">{detail.summary.last_ndvi.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-red-500">Change</p>
                    <p className="mt-1 text-[16px] font-bold tabular-nums text-red-600">{(detail.summary.ndvi_change * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-slate-600">{detail.summary.first_year} – {detail.summary.last_year}</span>
                  </div>
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
                    <polyline fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round"
                      points={yearly.map((p, i) => {
                        const x = pad.l + (i / (yearly.length - 1)) * pW;
                        const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                        return `${x},${y}`;
                      }).join(" ")}
                    />
                    <polygon fill="#FEE2E2" fillOpacity={0.3}
                      points={
                        yearly.map((p, i) => {
                          const x = pad.l + (i / (yearly.length - 1)) * pW;
                          const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                          return `${x},${y}`;
                        }).join(" ") + ` ${pad.l + pW},${pad.t + pH} ${pad.l},${pad.t + pH}`
                      }
                    />
                    {yearly.map((p, i) => {
                      const x = pad.l + (i / (yearly.length - 1)) * pW;
                      const y = pad.t + pH * (1 - (p.avg_ndvi - ndviRange.min) / (ndviRange.max - ndviRange.min || 0.001));
                      return <circle key={p.year} cx={x} cy={y} r={2} fill="#16A34A" stroke="white" strokeWidth={1} />;
                    })}
                  </svg>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700">Summary</span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    {detail.summary.trend === "declining"
                      ? `Vegetation health has declined by ${Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}% over ${detail.summary.last_year - detail.summary.first_year} years, indicating active deforestation or degradation. Forest cover reduced by ${Math.abs(detail.summary.cover_change_pct).toFixed(1)}%.`
                      : detail.summary.trend === "improving"
                        ? `NDVI improved by ${(detail.summary.ndvi_change * 100).toFixed(1)}%, suggesting reforestation or conservation success. Cover change: ${detail.summary.cover_change_pct > 0 ? "+" : ""}${detail.summary.cover_change_pct.toFixed(1)}%.`
                        : `Vegetation health has remained relatively stable over the monitored period (±${Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}% NDVI change).`
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
