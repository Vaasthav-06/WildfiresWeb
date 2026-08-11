"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, TrendingUp, Minus, Trees, Activity, Target, Map as MapIcon, Moon, Layers, Leaf, Search, Info } from "lucide-react";

const DeforestationMapInner = dynamic(() => import("@/components/map/DeforestationMap"), { ssr: false });

interface ZoneFeature { id: number; name: string; type: string; state?: string; geojson: string; ndvi_change: number; cover_change: number; trend: string; color: string }
interface YearlyPoint { year: number; avg_ndvi: number; avg_cover: number; avg_disturbance: number }
interface ZoneDetail {
  zone_name: string; zone_type: string; area_sq_deg?: number; intersected_zones?: number;
  intersected_names?: string[]; yearly: YearlyPoint[]; sea_body?: boolean;
  summary: { first_year: number; last_year: number; first_ndvi: number; last_ndvi: number; ndvi_change: number; cover_change_pct: number; trend: string };
}
const CHART_COLORS: Record<string, string> = { declining: "#DC2626", stable: "#F59E0B", improving: "#16A34A" };

function TrendPill({ trend, change }: { trend: string; change: number }) {
  const cfg = trend === "declining"
    ? { icon: TrendingDown, cls: "bg-red-500/10 text-red-500 border-red-500/20" }
    : trend === "improving"
      ? { icon: TrendingUp, cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" }
      : { icon: Minus, cls: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold backdrop-blur-md ${cfg.cls}`}>
      <cfg.icon className="h-3.5 w-3.5" />
      {trend} <span className="tabular-nums ml-0.5">({change > 0 ? "+" : ""}{change.toFixed(1)}%)</span>
    </span>
  );
}

export default function DeforestationPage() {
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [selected, setSelected] = useState<ZoneFeature | null>(null);
  const [detail, setDetail] = useState<ZoneDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [visibleTrends, setVisibleTrends] = useState<string[]>(["declining", "stable", "improving"]);
  const [basemap, setBasemap] = useState<"satellite" | "street" | "dark">("satellite");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const close = () => { setSelected(null); setDetail(null); setSearchQuery(""); };

  const onCustomDraw = useCallback(async (swLat: number, swLng: number, neLat: number, neLng: number, geojson?: any) => {
    setSelected(null); setDLoading(true); setDetail(null);
    try { 
      const r = await fetch(api("/api/v1/deforestation/analyze-area"), { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ lat1: swLat, lon1: swLng, lat2: neLat, lon2: neLng, geojson }) 
      });
      if (r.ok) { 
        const d = await r.json(); 
        setDetail(d); 
        setSelected({ id: 0, name: d.zone_name, type: d.zone_type, geojson: "", ndvi_change: d.summary.ndvi_change, cover_change: d.summary.cover_change_pct, trend: d.summary.trend, color: CHART_COLORS[d.summary.trend] || "#94A3B8" }); 
      }
    } catch {} finally { setDLoading(false); }
  }, []);

  const onZoneClick = useCallback(async (z: ZoneFeature) => {
    setSelected(z); setDLoading(true); setDetail(null);
    try { const r = await fetch(api(`/api/v1/deforestation/${z.id}`)); if (r.ok) setDetail(await r.json()); } catch {} finally { setDLoading(false); }
  }, []);

  const toggleTrend = (trend: string) => {
    setVisibleTrends(prev => prev.includes(trend) ? prev.filter(t => t !== trend) : [...prev, trend]);
  };

  const filteredSearch = useMemo(() => {
    if (!searchQuery) return [];
    return features.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
  }, [searchQuery, features]);

  const yearly = detail?.yearly || [];
  const ndviMin = yearly.length ? Math.min(...yearly.map((p: YearlyPoint) => p.avg_ndvi)) : 0;
  const ndviMax = yearly.length ? Math.max(...yearly.map((p: YearlyPoint) => p.avg_ndvi)) : 1;
  const ndviSpread = (ndviMax - ndviMin) || 0.01;

  const W = 760; const H = 340; const padT = 40; const padR = 25; const padB = 50; const padL = 68;
  const pw = W - padL - padR; const ph = H - padT - padB;
  
  const toX = (i: number) => padL + (i / Math.max(1, yearly.length - 1)) * pw;
  const toY = (v: number) => padT + ph * (1 - (v - ndviMin) / ndviSpread);

  // Smooth curve generator
  const getSmoothPath = (pts: {x: number, y: number}[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const cp1x = p1.x + (p2.x - p1.x) / 2;
      const cp2x = p1.x + (p2.x - p1.x) / 2;
      d += ` C${cp1x},${p1.y} ${cp2x},${p2.y} ${p2.x},${p2.y}`;
    }
    return d;
  };
  
  const chartPoints = yearly.map((p: YearlyPoint, i: number) => ({ x: toX(i), y: toY(p.avg_ndvi) }));
  const smoothPath = getSmoothPath(chartPoints);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900">
      <DeforestationMapInner 
        onZonesLoaded={setFeatures} 
        onZoneClick={onZoneClick} 
        onCustomDraw={onCustomDraw}
        visibleTrends={visibleTrends}
        basemap={basemap}
        searchedZoneId={selected?.id || null}
      />

      {/* Toolbar - Top Right */}
      <div className="absolute top-5 right-5 z-[500] flex flex-col items-end gap-3 pointer-events-none">
        
        {/* Main Toolbar Panel */}
        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-3xl px-3 py-3 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto">
          {/* Search Box */}
          <div className="relative group">
            <div className="flex items-center bg-black/20 rounded-xl px-3 py-2 w-64 ring-1 ring-white/10 focus-within:ring-white/30 transition-all">
              <Search className="h-4 w-4 text-white/70 mr-2" />
              <input 
                type="text" 
                placeholder="Search reserves..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="bg-transparent border-none outline-none text-sm text-white placeholder-white/50 w-full"
              />
            </div>
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {isSearchFocused && filteredSearch.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-3xl rounded-xl border border-white/20 shadow-xl overflow-hidden"
                >
                  {filteredSearch.map(f => (
                    <button 
                      key={f.id} 
                      className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center justify-between border-b border-black/5 last:border-0"
                      onClick={() => {
                        setSearchQuery("");
                        onZoneClick(f);
                      }}
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-800">{f.name}</div>
                        <div className="text-xs text-slate-500">{f.state || 'India'}</div>
                      </div>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[f.trend] }} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Basemap Switcher */}
          <div className="flex gap-1 bg-black/20 p-1 rounded-xl ring-1 ring-white/10">
            {[
              { id: "satellite", icon: Layers, label: "Satellite" },
              { id: "dark", icon: Moon, label: "Dark" },
              { id: "street", icon: MapIcon, label: "Map" }
            ].map(b => (
              <button
                key={b.id}
                title={b.label}
                onClick={() => setBasemap(b.id as any)}
                className={`p-2 rounded-lg transition-all ${basemap === b.id ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/10"}`}
              >
                <b.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend - Bottom Left */}
      <div className="absolute bottom-5 left-5 z-[500] pointer-events-auto">
        <div className="bg-slate-900/40 backdrop-blur-3xl px-5 py-4 rounded-2xl border border-white/10 shadow-2xl w-64">
          <div className="flex items-center gap-2 mb-4">
            <Trees className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Vegetation Health</h3>
          </div>
          <div className="space-y-2">
            {[
              { id: "declining", label: "Declining", color: "#EF4444" },
              { id: "stable", label: "Stable", color: "#F59E0B" },
              { id: "improving", label: "Improving", color: "#10B981" }
            ].map((t) => {
              const isActive = visibleTrends.includes(t.id);
              return (
                <button 
                  key={t.id} 
                  onClick={() => toggleTrend(t.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${isActive ? 'bg-white/10 border-white/10' : 'bg-transparent border-transparent opacity-50 hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full shadow-inner" style={{ background: t.color }} />
                    <span className="text-sm font-medium text-white">{t.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs text-white/50">{features.length} reserves</span>
            <span className="text-xs font-semibold text-white/80">{visibleTrends.length}/3 layers</span>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selected && (
          <motion.div 
            initial={{ x: "100%", opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: "100%", opacity: 0 }} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }} 
            className="absolute top-0 right-0 z-[600] h-full w-[480px] bg-slate-900/70 backdrop-blur-3xl border-l border-white/10 shadow-2xl flex flex-col"
          >
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between bg-white/5">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-2xl font-bold text-white tracking-tight leading-tight mb-1">{selected.name}</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="px-2 py-1 bg-white/10 rounded-md text-xs font-medium text-white/70 capitalize">{selected.type.replace(/_/g, " ")}</span>
                  {selected.state && <span className="text-sm text-white/50">{selected.state}</span>}
                </div>
              </div>
              <button onClick={close} className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl p-2 transition-all mt-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {dLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
                  <span className="text-sm text-white/50">Analyzing vegetation data...</span>
                </div>
              ) : detail?.sea_body ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="rounded-2xl bg-blue-500/10 p-5 mb-5 ring-1 ring-blue-500/20"><Target className="h-10 w-10 text-blue-400 mx-auto" /></div>
                  <h3 className="text-lg font-bold text-white mb-2">Sea / Ocean Body</h3>
                  <p className="text-sm text-white/60 leading-relaxed max-w-xs">Vegetation analysis is not available for ocean areas. Please select a land region.</p>
                </div>
              ) : detail ? (
                <div className="space-y-8">
                  
                  {/* Header Meta */}
                  <div className="flex items-center justify-between">
                    <TrendPill trend={detail.summary.trend} change={detail.summary.ndvi_change * 100} />
                    {detail.area_sq_deg && <span className="text-sm text-white/50 font-medium tabular-nums">{detail.area_sq_deg.toFixed(2)} sq deg</span>}
                  </div>

                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Leaf className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Current NDVI</span>
                      </div>
                      <div className="text-3xl font-bold text-white tabular-nums">{detail.summary.last_ndvi.toFixed(3)}</div>
                      <div className="text-xs text-white/40 mt-1">As of {detail.summary.last_year}</div>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Cover Loss</span>
                      </div>
                      <div className="text-3xl font-bold text-white tabular-nums">{Math.abs(detail.summary.cover_change_pct).toFixed(1)}%</div>
                      <div className="text-xs text-white/40 mt-1">Since {detail.summary.first_year}</div>
                    </div>
                  </div>

                  {/* Modern Chart */}
                  <div 
                    className="relative bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden group cursor-pointer hover:bg-white/10 transition-all"
                    onClick={() => setChartExpanded(true)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-bold text-white">NDVI Trend</span>
                      </div>
                      <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">Click to expand</span>
                    </div>
                    
                    <div className="h-[180px] w-full relative">
                      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="block overflow-visible">
                        <defs>
                          <linearGradient id="ndviGradModern" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>
                        
                        {/* Simplified Grid */}
                        <line x1={padL} y1={toY(ndviMin)} x2={padL + pw} y2={toY(ndviMin)} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />
                        <line x1={padL} y1={toY(ndviMax)} x2={padL + pw} y2={toY(ndviMax)} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />
                        
                        {/* Area */}
                        {smoothPath && <path d={`${smoothPath} L${toX(yearly.length - 1)},${H - padB} L${toX(0)},${H - padB} Z`} fill="url(#ndviGradModern)" stroke="none" />}
                        
                        {/* Smooth Line */}
                        {smoothPath && <path d={smoothPath} fill="none" stroke="#10B981" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 4px 6px rgba(16, 185, 129, 0.3))' }} />}
                        
                        {/* Points */}
                        {yearly.map((p: YearlyPoint, i: number) => {
                          const x = toX(i); const y = toY(p.avg_ndvi);
                          const showLabel = i === 0 || i === yearly.length - 1;
                          return <g key={p.year}>
                            <circle cx={x} cy={y} r={showLabel ? 5 : 0} fill="#1E293B" stroke="#10B981" strokeWidth={3} className="group-hover:r-[4px] transition-all duration-300" />
                            {showLabel && (
                              <text x={x} y={y - 15} textAnchor={i === 0 ? "start" : "end"} fill="#ffffff" fillOpacity={0.9} fontSize={14} fontWeight={700}>{p.avg_ndvi.toFixed(3)}</text>
                            )}
                          </g>;
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Assessment Details */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-bold text-white tracking-wide">Analysis</span>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {detail.summary.trend === "declining"
                        ? <><strong className="text-red-400">Declining trend detected.</strong> Vegetation health has decreased by <strong className="text-red-400">{Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}%</strong> over {detail.summary.last_year - detail.summary.first_year} years, with a forest cover loss of <strong className="text-amber-400">{Math.abs(detail.summary.cover_change_pct).toFixed(1)}%</strong>. Active deforestation or degradation is likely.</>
                        : detail.summary.trend === "improving"
                          ? <><strong className="text-emerald-400">Positive recovery trend.</strong> NDVI has improved by <strong className="text-emerald-400">{(detail.summary.ndvi_change * 100).toFixed(1)}%</strong> over the monitored period, suggesting successful conservation.</>
                          : <><strong className="text-amber-400">Stable conditions.</strong> Vegetation health has remained relatively consistent (±{Math.abs(detail.summary.ndvi_change * 100).toFixed(1)}% NDVI variation). Continued monitoring recommended.</>
                      }
                    </p>
                  </div>
                  
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Chart Modal */}
      <AnimatePresence>
        {chartExpanded && detail && yearly.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-8"
            onClick={() => setChartExpanded(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-slate-800 border border-white/10 rounded-3xl shadow-2xl p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setChartExpanded(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                <X className="h-6 w-6" />
              </button>
              
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{detail.zone_name} - Detailed NDVI</h3>
                <p className="text-white/50">{detail.summary.first_year} to {detail.summary.last_year}</p>
              </div>
              
              <div className="h-[400px] w-full">
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="block overflow-visible">
                  <defs>
                    <linearGradient id="ndviGradModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac: number) => {
                    const val = ndviMin + ndviSpread * frac;
                    const y = toY(val);
                    return <g key={frac}>
                      <line x1={padL} y1={y} x2={padL + pw} y2={y} stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1} />
                      <text x={padL - 15} y={y + 4} textAnchor="end" fill="#ffffff" fillOpacity={0.5} fontSize={12} fontFamily="system-ui">{val.toFixed(3)}</text>
                    </g>;
                  })}
                  
                  {/* X Axis */}
                  {yearly.filter((_: any, i: number) => i % 3 === 0).map((p: YearlyPoint) => (
                    <text key={p.year} x={toX(yearly.indexOf(p))} y={H - 10} textAnchor="middle" fill="#ffffff" fillOpacity={0.5} fontSize={12} fontFamily="system-ui">{p.year}</text>
                  ))}
                  
                  {/* Area */}
                  {smoothPath && <path d={`${smoothPath} L${toX(yearly.length - 1)},${H - padB} L${toX(0)},${H - padB} Z`} fill="url(#ndviGradModal)" stroke="none" />}
                  
                  {/* Smooth Line */}
                  {smoothPath && <path d={smoothPath} fill="none" stroke="#10B981" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
                  
                  {/* Hover Points & Tooltips (Interactive SVG) */}
                  {yearly.map((p: YearlyPoint, i: number) => {
                    const x = toX(i); const y = toY(p.avg_ndvi);
                    return (
                      <g key={p.year} className="group cursor-crosshair">
                        {/* Invisible large circle for easier hovering */}
                        <circle cx={x} cy={y} r={20} fill="transparent" />
                        <circle cx={x} cy={y} r={4} fill="#1E293B" stroke="#10B981" strokeWidth={2.5} className="group-hover:r-[7px] transition-all duration-200" />
                        
                        {/* Tooltip */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <rect x={x - 45} y={y - 65} width={90} height={45} rx={8} fill="#ffffff" filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.3))" />
                          <text x={x} y={y - 45} textAnchor="middle" fill="#0F172A" fontSize={14} fontWeight="bold">{p.avg_ndvi.toFixed(3)}</text>
                          <text x={x} y={y - 30} textAnchor="middle" fill="#64748B" fontSize={11} fontWeight="medium">{p.year}</text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
