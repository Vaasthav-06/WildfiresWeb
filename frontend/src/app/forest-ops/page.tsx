"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Trees, Droplets, Building2, MapPin, Shield, Info,
  BarChart3, AlertTriangle, Globe2, Navigation2, Flame, Clock,
  BellRing, ChevronRight, ChevronLeft, Map as MapIcon, Activity,
  TrendingUp, Cpu, X,
} from "lucide-react";
import { REGIONS, getRegion } from "@/lib/regions";
import { ZONE_STYLE } from "@/lib/gisLayers";
import { useAlerts, useAlertSummary, type Alert } from "@/hooks/useAlerts";
import { useRegionAnalysis } from "@/hooks/useRegionAnalysis";
import RiskCard from "@/components/region-analysis/RiskCard";
import WeatherPanel from "@/components/region-analysis/WeatherPanel";
import FeatureImportance from "@/components/region-analysis/FeatureImportance";
import PredictionExplanation from "@/components/region-analysis/PredictionExplanation";
import ModelInfo from "@/components/region-analysis/ModelInfo";
import Timeline from "@/components/region-analysis/Timeline";
import { Skeleton, ErrorState } from "@/components/region-analysis/LoadingStates";
import PredictionModal from "@/components/overlays/PredictionModal";
import { useAppStore } from "@/stores/appStore";

const GISPortalMap = dynamic(
  () => import("@/components/gis-portal/GISPortalMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-slate-400 text-sm">Loading map...</p>
        </div>
      </div>
    ),
  }
);

type OverlayKey = "boundaries" | "geofence" | "water" | "buildings" | "locations" | "alerts";
type SidebarTab = "layers" | "alerts" | "analysis";

const LAYER_CONFIG: Array<{ key: OverlayKey; label: string; icon: React.ElementType; color: string }> = [
  { key: "boundaries", label: "Reserve Boundaries", icon: Globe2, color: "#16A34A" },
  { key: "geofence", label: "Geo-Fence Zones", icon: Shield, color: "#DC2626" },
  { key: "water", label: "Water Bodies", icon: Droplets, color: "#2563EB" },
  { key: "buildings", label: "Infrastructure", icon: Building2, color: "#D97706" },
  { key: "locations", label: "Landmarks & Posts", icon: MapPin, color: "#7C3AED" },
  { key: "alerts", label: "Active Fire Alerts", icon: AlertTriangle, color: "#DC2626" },
];

const ZONE_LEGEND = [
  { type: "core_zone" as const },
  { type: "buffer_zone" as const },
  { type: "eco_sensitive_zone" as const },
];

const REGION_ADMIN: Record<string, { division: string; ranges: string[]; beats: string; compartments: string; area_ha: string }> = {
  corbett: { division: "Corbett Tiger Reserve", ranges: ["Dhikala", "Bijrani", "Jhirna", "Dhela", "Sonanadi"], beats: "47 beats across 5 ranges", compartments: "122 compartments", area_ha: "1,31,800 ha" },
  similipal: { division: "Similipal Tiger Reserve, Baripada", ranges: ["Baripada", "Khadgarh", "Pithabata", "Nawana", "Jashipur"], beats: "64 beats across 5 ranges", compartments: "241 compartments", area_ha: "2,75,000 ha" },
  jyotikuchi: { division: "Kamrup Forest Division", ranges: ["Jyotikuchi Range"], beats: "8 beats", compartments: "22 compartments", area_ha: "8,500 ha" },
  laisong: { division: "Dima Hasao Forest Division", ranges: ["Haflong Range", "Laisong Range"], beats: "18 beats across 2 ranges", compartments: "56 compartments", area_ha: "45,000 ha" },
};

const STATUS_CONFIG = {
  active: { color: "#DC2626", bg: "bg-red-950/60", ring: "ring-red-800/60", label: "Active" },
  watch: { color: "#F59E0B", bg: "bg-amber-950/60", ring: "ring-amber-800/60", label: "Watch" },
  safe: { color: "#16A34A", bg: "bg-emerald-950/60", ring: "ring-emerald-800/60", label: "Clear" },
};

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ""; }
}

function TabBtn({ active, onClick, icon: Icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 flex-1 px-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
        active ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="leading-none">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export default function ForestOpsPage() {
  const [activeRegion, setActiveRegion] = useState("corbett");
  const [activeTab, setActiveTab] = useState<SidebarTab>("layers");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Record<OverlayKey, boolean>>({
    boundaries: true, geofence: true, water: true, buildings: true, locations: true, alerts: true,
  });
  const [selectedFeature, setSelectedFeature] = useState<Record<string, string> | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const flyToAlert = selectedAlert ? { lat: selectedAlert.lat, lon: selectedAlert.lon } : null;

  const { data: alerts = [], isLoading: alertsLoading } = useAlerts();
  const { data: alertSummary = [] } = useAlertSummary();
  const { data: analysis, isLoading: analysisLoading, error: analysisError, refetch: refetchAnalysis } = useRegionAnalysis(activeRegion);

  const region = getRegion(activeRegion);
  const admin = REGION_ADMIN[activeRegion];
  const alertedZones = alertSummary.filter((z) => z.status !== "safe");

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (activeTab !== "analysis") return;
    useAppStore.setState({ predictionMode: true, selectedPoint: { lat, lon } });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "analysis") {
      useAppStore.setState({ predictionMode: false, selectedPoint: null });
    }
  }, [activeTab]);

  const handleRegionChange = useCallback((regionId: string) => {
    useAppStore.setState({ predictionMode: false, selectedPoint: null });
    setSelectedAlert(null);
    setSelectedFeature(null);
    setActiveRegion(regionId);
  }, []);

  const toggleLayer = useCallback((key: OverlayKey) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleAllLayers = useCallback((on: boolean) => {
    setVisibleLayers({ boundaries: on, geofence: on, water: on, buildings: on, locations: on, alerts: on });
  }, []);

  const handleFeatureClick = useCallback((props: Record<string, string>) => { setSelectedFeature(props); }, []);

  const handleAlertClick = useCallback((alert: Alert) => {
    setSelectedAlert(alert);
    setSelectedFeature({
      name: alert.zone_name,
      layer_type: "Fire Alert",
      description: `${alert.date} \u00B7 ${alert.confidence.toUpperCase()} confidence`,
      protection_level: `FRP ${alert.frp.toFixed(1)} MW`,
      state: alert.state,
    });
  }, []);

  const allVisible = Object.values(visibleLayers).every(Boolean);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-950">
      {/* LEFT SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="shrink-0 h-full overflow-hidden border-r border-slate-800 bg-[#0C1220] flex flex-col"
          >
            <div className="flex flex-col h-full w-[360px]">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="h-8 w-8 rounded-lg bg-emerald-600/20 ring-1 ring-emerald-500/40 flex items-center justify-center shrink-0">
                    <MapIcon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-[15px] font-bold text-white leading-tight tracking-tight">Forest Operations Hub</h1>
                    <p className="text-[11px] text-slate-500">GIS &middot; Geo-Fencing &middot; Risk Analysis</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Monitored Regions</p>
                  <div className="space-y-1">
                    {REGIONS.map((r) => (
                      <button key={r.id} onClick={() => handleRegionChange(r.id)}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150 ${
                          activeRegion === r.id ? "bg-emerald-600/15 ring-1 ring-emerald-500/30 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}>
                        <Trees className={`h-3.5 w-3.5 shrink-0 ${activeRegion === r.id ? "text-emerald-400" : "text-slate-600"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold leading-tight truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-500">{r.state} &middot; {r.area_sq_km} km&sup2;</p>
                        </div>
                        {activeRegion === r.id && <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab Bar */}
              <div className="px-4 py-3 border-b border-slate-800/80 flex gap-2">
                <TabBtn active={activeTab === "layers"} onClick={() => setActiveTab("layers")} icon={Layers} label="GIS Layers" />
                <TabBtn active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} icon={BellRing} label="Alerts" badge={alerts.length} />
                <TabBtn active={activeTab === "analysis"} onClick={() => setActiveTab("analysis")} icon={Activity} label="Analysis" />
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">

                  {/* GIS LAYERS TAB */}
                  {activeTab === "layers" && (
                    <motion.div key="layers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="p-4 space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                            <Layers className="h-3 w-3" /> Map Layers
                          </p>
                          <div className="flex gap-1.5">
                            <button onClick={() => toggleAllLayers(true)} className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${allVisible ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>All on</button>
                            <button onClick={() => toggleAllLayers(false)} className="text-[10px] font-medium text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded transition-colors">All off</button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {LAYER_CONFIG.map(({ key, label, icon: Icon, color }) => (
                            <button key={key} onClick={() => toggleLayer(key)}
                              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all ${
                                visibleLayers[key] ? "bg-slate-800/80 text-slate-200" : "text-slate-500 hover:bg-slate-800/40 hover:text-slate-400"
                              }`}>
                              <div className="h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                                style={{ background: visibleLayers[key] ? color : "transparent", borderColor: visibleLayers[key] ? color : "#475569" }}>
                                {visibleLayers[key] && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2,6 5,9 10,3" /></svg>
                                )}
                              </div>
                              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: visibleLayers[key] ? color : "#64748B" }} />
                              <span className="text-[12px] font-medium">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800/80">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Zone Types</p>
                        <div className="space-y-2">
                          {ZONE_LEGEND.map(({ type }) => {
                            const style = ZONE_STYLE[type];
                            return (
                              <div key={type} className="flex items-center gap-2.5">
                                <div className="h-3 w-7 rounded-sm shrink-0" style={{ background: style.fill, opacity: 0.85, border: `2px solid ${style.color}` }} />
                                <span className="text-[11px] text-slate-400">{style.label}</span>
                                <p className="text-[10px] text-slate-600 ml-auto">{type === "core_zone" ? "Critical" : type === "buffer_zone" ? "High" : "Elevated"}</p>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">Alerts inside Core Zones are classified critical. Buffer alerts are high priority. Eco-Sensitive alerts are elevated.</p>
                      </div>

                      {admin && (
                        <div className="pt-4 border-t border-slate-800/80">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                            <BarChart3 className="h-3 w-3" /> Administrative Data
                          </p>
                          <div className="space-y-2">
                            <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Division</p>
                              <p className="text-[12px] text-slate-200 font-medium">{admin.division}</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Ranges</p>
                              <div className="flex flex-wrap gap-1">
                                {admin.ranges.map((r) => (
                                  <span key={r} className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">{r}</span>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-slate-800/50 px-3 py-2.5"><p className="text-[10px] text-slate-500 mb-0.5">Beats</p><p className="text-[11px] text-slate-300">{admin.beats}</p></div>
                              <div className="rounded-lg bg-slate-800/50 px-3 py-2.5"><p className="text-[10px] text-slate-500 mb-0.5">Total Area</p><p className="text-[11px] text-slate-300">{admin.area_ha}</p></div>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 px-3 py-2.5"><p className="text-[10px] text-slate-500 mb-0.5">Compartments</p><p className="text-[12px] text-slate-300">{admin.compartments}</p></div>
                          </div>
                          <div className="mt-3 rounded-lg bg-blue-950/50 ring-1 ring-blue-800/40 px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-1.5"><Navigation2 className="h-3 w-3 text-blue-400" /><p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Spatial Query</p></div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">Point-in-polygon checks classify detection coordinates against Core, Buffer, and Eco-Sensitive zones in real time.</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ALERTS TAB */}
                  {activeTab === "alerts" && (
                    <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl bg-red-950/50 ring-1 ring-red-800/40 p-3.5">
                          <div className="flex items-center gap-1.5 mb-1"><Flame className="h-3.5 w-3.5 text-red-400" /><p className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">Active Alerts</p></div>
                          <p className="text-[28px] font-black tabular-nums text-red-400">{alerts.length}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">fire detections</p>
                        </div>
                        <div className="rounded-xl bg-amber-950/50 ring-1 ring-amber-800/40 p-3.5">
                          <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /><p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Zones Alerted</p></div>
                          <p className="text-[28px] font-black tabular-nums text-amber-400">{alertedZones.length}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">of {alertSummary.length || 5} monitored</p>
                        </div>
                      </div>

                      {alertSummary.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Zone Status</p>
                          <div className="space-y-1.5">
                            {alertSummary.map((z) => {
                              const cfg = STATUS_CONFIG[z.status];
                              return (
                                <div key={z.zone_id} className={`rounded-lg ${cfg.bg} ring-1 ${cfg.ring} px-3 py-2.5`}>
                                  <div className="flex items-center justify-between">
                                    <div><p className="text-[12px] font-bold text-slate-200">{z.zone_name}</p><p className="text-[10px] text-slate-500">{z.state}</p></div>
                                    <div className="flex items-center gap-2">
                                      {z.alert_count > 0 && <span className="text-[12px] font-bold tabular-nums text-slate-400">{z.alert_count}</span>}
                                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ background: cfg.color }}>{cfg.label}</span>
                                    </div>
                                  </div>
                                  {z.alert_count > 0 && (
                                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                                      <span>Max FRP: <strong className="text-slate-400">{z.max_frp.toFixed(1)} MW</strong></span>
                                      <span>High conf: <strong className="text-slate-400">{z.high_confidence}</strong></span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                          Alert Feed {alerts.length > 0 && <span className="ml-1.5 rounded-full bg-red-900/60 px-1.5 py-0.5 text-[9px] text-red-400">{alerts.length}</span>}
                        </p>
                        {alertsLoading && <div className="py-8 text-center text-[13px] text-slate-500">Loading alerts...</div>}
                        {!alertsLoading && alerts.length === 0 && (
                          <div className="flex flex-col items-center py-10 text-center">
                            <Shield className="h-7 w-7 text-emerald-500 mb-2.5" />
                            <p className="text-[14px] font-semibold text-slate-300">All Zones Clear</p>
                            <p className="mt-1 text-[12px] text-slate-500">No active fire detections inside any monitored reserve</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          {alerts.map((a) => (
                            <button key={a.key} onClick={() => handleAlertClick(a)}
                              className={`w-full text-left rounded-xl p-3.5 transition-all hover:ring-1 ${
                                selectedAlert?.key === a.key ? "bg-slate-800 ring-1 ring-blue-500/60 shadow-lg" : "bg-slate-800/50 hover:bg-slate-800 hover:ring-slate-700"
                              }`}>
                              <div className="flex items-start gap-2.5">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold text-slate-200 truncate">{a.zone_name}</p>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500"><MapPin className="h-3 w-3" />{a.lat.toFixed(2)}&deg;, {a.lon.toFixed(2)}&deg;</div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-semibold tabular-nums text-slate-300">FRP {a.frp.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">MW</span></span>
                                    <span className="text-[11px] tabular-nums text-slate-400">{a.brightness.toFixed(0)}K</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${a.confidence === "h" ? "bg-red-900/60 text-red-400" : a.confidence === "n" ? "bg-orange-900/60 text-orange-400" : "bg-amber-900/60 text-amber-400"}`}>
                                      {a.confidence === "h" ? "High" : a.confidence === "n" ? "Nominal" : "Low"}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-600"><Clock className="h-2.5 w-2.5" />{a.date} &middot; {timeAgo(a.detected_at)}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl bg-blue-950/40 ring-1 ring-blue-800/30 p-3.5">
                        <div className="flex items-start gap-2.5">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80 mb-1">How It Works</p>
                            <p className="text-[11px] leading-relaxed text-slate-500">NASA FIRMS satellites detect thermal anomalies globally. When a detection falls within any monitored reserve boundary, a geo-fence alert is triggered. Alerts deduplicate within 2 hours and expire after 24 hours.</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ANALYSIS TAB */}
                  {activeTab === "analysis" && (
                    <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="p-4 space-y-4">
                      {region && (
                        <div className="rounded-xl bg-slate-800/50 ring-1 ring-slate-700/60 p-4">
                          <h2 className="text-[13px] font-bold text-slate-200">{region.name}</h2>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{region.description}</p>
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                            <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-600" /><span className="text-[11px] text-slate-500">{region.state}</span></div>
                            <div className="flex items-center gap-1.5"><Trees className="h-3 w-3 text-slate-600" /><span className="text-[11px] text-slate-500">{region.area_sq_km} km&sup2;</span></div>
                            <div className="flex items-center gap-1.5"><Flame className="h-3 w-3 text-slate-600" /><span className="text-[11px] text-slate-500">{region.fire_season}</span></div>
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg bg-indigo-950/50 ring-1 ring-indigo-800/30 px-3 py-2.5 flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-slate-400 leading-relaxed">Click any point on the map to get a local fire-risk prediction for that location.</p>
                      </div>
                      {analysisLoading && <Skeleton />}
                      {analysisError && <ErrorState message={(analysisError as Error).message} onRetry={() => refetchAnalysis()} />}
                      {analysis && (
                        <div className="space-y-4">
                          <RiskCard label={analysis.risk.label} probability={analysis.risk.probability} confidence={analysis.risk.confidence} />
                          <WeatherPanel weather={analysis.weather} />
                          <FeatureImportance items={analysis.feature_importance} />
                          <PredictionExplanation text={analysis.explanation} />
                          <ModelInfo model={analysis.model} />
                          <Timeline lastUpdated={analysis.last_updated} />
                        </div>
                      )}
                      {!analysisLoading && !analysisError && !analysis && (
                        <div className="py-8 text-center">
                          <Cpu className="mx-auto h-6 w-6 text-slate-600 mb-2" />
                          <p className="text-[13px] text-slate-500">Select a region to load analysis</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN MAP AREA */}
      <main className="flex-1 relative overflow-hidden">
        <GISPortalMap
          activeRegion={activeRegion}
          visibleLayers={visibleLayers}
          onFeatureClick={handleFeatureClick}
          alerts={alerts}
          onAlertClick={handleAlertClick}
          onMapClick={handleMapClick}
          flyToAlert={flyToAlert}
        />

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen((p) => !p)}
          className="absolute top-4 left-4 z-[500] rounded-lg bg-slate-900/90 backdrop-blur-md p-2 shadow-lg ring-1 ring-white/10 text-slate-400 hover:text-white transition-colors"
          title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}>
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Active region badge */}
        <motion.div key={activeRegion} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-16 z-[500] flex items-center gap-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md px-4 py-2 shadow-xl ring-1 ring-white/10">
          <Trees className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-[13px] font-bold text-white leading-tight">{region?.name}</p>
            <p className="text-[10px] text-slate-400">{region?.state} &middot; {region?.forest_type}</p>
          </div>
        </motion.div>

        {/* Contextual top-right badge */}
        <AnimatePresence>
          {activeTab === "analysis" && analysis && (
            <motion.div key="risk-badge" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-4 right-16 z-[500] rounded-xl bg-slate-900/90 backdrop-blur-md px-4 py-2 shadow-xl ring-1 ring-white/10 flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Risk Assessment</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                style={{ background: analysis.risk.label === "Extreme" ? "#7C3AED" : analysis.risk.label === "Very High" ? "#DC2626" : analysis.risk.label === "High" ? "#EA580C" : analysis.risk.label === "Moderate" ? "#D97706" : "#16A34A" }}>
                {analysis.risk.label}
              </span>
              <span className="text-[12px] font-mono tabular-nums text-slate-300">{analysis.risk.probability.toFixed(1)}%</span>
            </motion.div>
          )}
          {activeTab === "alerts" && selectedAlert && (
            <motion.div key="alert-banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-4 right-16 z-[500] flex items-center gap-4 rounded-2xl bg-slate-900/95 backdrop-blur-md px-5 py-3 shadow-2xl ring-1 ring-white/10">
              <Flame className="h-4 w-4 text-red-400" />
              <div><p className="text-[13px] font-bold text-white">{selectedAlert.zone_name}</p><p className="text-[11px] text-slate-400">{selectedAlert.date}</p></div>
              <div className="w-px h-7 bg-slate-700" />
              <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-slate-500">FRP</p><p className="text-[15px] font-bold tabular-nums text-slate-200">{selectedAlert.frp.toFixed(1)} MW</p></div>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-500 hover:text-slate-300 transition-colors ml-2"><X className="h-4 w-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature info popup */}
        <AnimatePresence>
          {selectedFeature && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] rounded-2xl bg-slate-900/95 backdrop-blur-md px-5 py-4 shadow-2xl ring-1 ring-white/10 max-w-[440px] w-full mx-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                      {selectedFeature.zone_type ? (ZONE_STYLE[selectedFeature.zone_type as keyof typeof ZONE_STYLE]?.label || "Zone") : selectedFeature.layer_type || "Feature"}
                    </p>
                  </div>
                  <p className="text-[14px] font-bold text-white truncate">{selectedFeature.name || "Unnamed Feature"}</p>
                  {selectedFeature.description && <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{selectedFeature.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedFeature.protection_level && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{selectedFeature.protection_level}</span>}
                    {selectedFeature.management_unit && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{selectedFeature.management_unit}</span>}
                    {selectedFeature.area_sqkm && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{selectedFeature.area_sqkm} km&sup2;</span>}
                    {selectedFeature.state && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{selectedFeature.state}</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedFeature(null)} className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none shrink-0 mt-0.5">&times;</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Geo-fence summary badge */}
        <div className="absolute bottom-5 left-4 z-[500] rounded-xl bg-slate-900/90 backdrop-blur-md px-4 py-2.5 text-white shadow-xl ring-1 ring-white/10">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Geo-Fence Monitoring</p>
          <p className="mt-0.5 text-[12px] font-semibold">{alerts.length} active detection{alerts.length === 1 ? "" : "s"}</p>
          <p className="text-[10px] text-slate-500">{alertedZones.length} zone{alertedZones.length === 1 ? "" : "s"} under watch</p>
        </div>

        {/* Right panel toggle */}
        <button onClick={() => setRightPanelOpen((p) => !p)}
          className="absolute top-4 right-4 z-[500] rounded-lg bg-slate-900/90 backdrop-blur-md p-2 shadow-lg ring-1 ring-white/10 text-slate-400 hover:text-white transition-colors"
          title="Toggle info panel">
          <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${rightPanelOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Right info panel */}
        <AnimatePresence>
          {rightPanelOpen && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
              className="absolute top-14 right-4 z-[500] w-[240px] space-y-2.5">
              <div className="rounded-xl bg-slate-900/90 backdrop-blur-md p-4 ring-1 ring-white/10 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">Region Overview</p>
                <div className="space-y-2">
                  {[
                    { label: "Forest Type", value: region?.forest_type },
                    { label: "Fire Season", value: region?.fire_season },
                    { label: "Elevation", value: region?.elevation },
                    { label: "Area", value: `${region?.area_sq_km} km\u00B2` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
                      <span className="text-[11px] text-slate-200 font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 backdrop-blur-md p-4 ring-1 ring-white/10 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-400" /> Zone Priority
                </p>
                <div className="space-y-1.5">
                  {ZONE_LEGEND.map(({ type }) => {
                    const style = ZONE_STYLE[type];
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div className="h-2.5 w-5 rounded-sm shrink-0" style={{ background: style.fill, border: `1.5px solid ${style.color}` }} />
                        <span className="text-[11px] text-slate-300">{style.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-slate-900/90 backdrop-blur-md p-4 ring-1 ring-white/10 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Coordinates</p>
                <p className="text-[11px] text-slate-300 font-mono">Centre: {region?.center.lat}&deg;N, {region?.center.lon}&deg;E</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Bounds: {region?.bounds.lat_min}&ndash;{region?.bounds.lat_max}&deg;N</p>
                <p className="text-[10px] text-slate-500 font-mono">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{region?.bounds.lon_min}&ndash;{region?.bounds.lon_max}&deg;E</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <PredictionModal />
      </main>
    </div>
  );
}
