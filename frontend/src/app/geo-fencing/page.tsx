"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { BellRing, Flame, MapPin, Shield, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useAlerts, useAlertSummary, type Alert, type ZoneSummary } from "@/hooks/useAlerts";

const GeoFenceMap = dynamic(() => import("@/components/map/GeoFenceMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-slate-200" />,
});

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

const STATUS_CONFIG = {
  active: { color: "#DC2626", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", icon: AlertTriangle, label: "Active Fires" },
  watch: { color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: BellRing, label: "Under Watch" },
  safe: { color: "#16A34A", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", icon: CheckCircle2, label: "All Clear" },
};

export default function GeoFencingPage() {
  const { data: alerts, isLoading } = useAlerts();
  const { data: summary } = useAlertSummary();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const activeCount = alerts?.length || 0;
  const watchZones = summary?.filter((z) => z.status === "watch" || z.status === "active") || [];
  const safeZones = summary?.filter((z) => z.status === "safe") || [];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#F8FAFC]">
      {/* SIDEBAR */}
      <aside className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 p-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Geo-Fence Monitoring</h1>
          <p className="mt-1.5 text-[14px] text-slate-500 leading-relaxed">
            Real-time fire detection alerts inside protected forest reserves across India. Powered by NASA FIRMS satellite data.
          </p>
        </motion.div>

        {/* STAT CARDS */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-white ring-1 ring-slate-200/60 p-4"
          >
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Active Alerts</p>
            </div>
            <p className="mt-2 text-[32px] font-black tabular-nums text-red-600">{activeCount}</p>
            <p className="mt-1 text-[12px] text-slate-400">fire detections inside reserves</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl bg-white ring-1 ring-slate-200/60 p-4"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Zones Alerted</p>
            </div>
            <p className="mt-2 text-[32px] font-black tabular-nums text-amber-600">{watchZones.length}</p>
            <p className="mt-1 text-[12px] text-slate-400">of {summary?.length || 5} monitored reserves</p>
          </motion.div>
        </div>

        {/* ZONE STATUS LIST */}
        {summary && summary.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Zone Status</p>
            {summary.map((z) => {
              const cfg = STATUS_CONFIG[z.status];
              return (
                <motion.div
                  key={z.zone_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * summary.indexOf(z) }}
                  className={`rounded-xl ${cfg.bg} ${cfg.ring} ring-1 p-4`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-slate-800">{z.zone_name}</p>
                      <p className="text-[12px] text-slate-500">{z.state}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {z.alert_count > 0 && (
                        <span className="text-[13px] font-bold tabular-nums text-slate-600">{z.alert_count}</span>
                      )}
                      <span
                        className="rounded-full px-3 py-1 text-[12px] font-bold text-white"
                        style={{ background: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  {z.alert_count > 0 && (
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-slate-500">
                      <span>Max FRP: <strong className="text-slate-700">{z.max_frp.toFixed(1)} MW</strong></span>
                      <span>High conf: <strong className="text-slate-700">{z.high_confidence}</strong></span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ACTIVE ALERTS */}
        <div className="mt-5 space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400">
            Alert Feed
            {alerts && alerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600">{alerts.length}</span>
            )}
          </p>

          {isLoading && (
            <div className="py-8 text-center text-[14px] text-slate-400">Loading alerts...</div>
          )}

          {alerts && alerts.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <Shield className="h-8 w-8 text-emerald-400 mb-3" />
              <p className="text-[15px] font-semibold text-slate-600">All zones clear</p>
              <p className="mt-1 text-[13px] text-slate-400">No active fire detections inside any monitored reserve</p>
            </div>
          )}

          {alerts && alerts.map((a) => (
            <motion.button
              key={a.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedAlert(a)}
              className={`w-full text-left rounded-xl bg-white ring-1 p-4 transition-all hover:shadow-md ${
                selectedAlert?.key === a.key ? "ring-2 ring-blue-500 shadow-md" : "ring-slate-200/60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-[14px] font-bold text-slate-800 truncate">{a.zone_name}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[13px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {a.lat.toFixed(2)}°, {a.lon.toFixed(2)}°
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-[13px] font-semibold tabular-nums text-slate-700">
                      FRP {a.frp.toFixed(1)} <span className="text-[11px] font-normal text-slate-400">MW</span>
                    </span>
                    <span className="text-[13px] tabular-nums text-slate-600">
                      {a.brightness.toFixed(0)} <span className="text-[11px] text-slate-400">K</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                      a.confidence === "h" ? "bg-red-100 text-red-700" :
                      a.confidence === "n" ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {a.confidence === "h" ? "High" : a.confidence === "n" ? "Nominal" : "Low"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    {a.date} &middot; {timeAgo(a.detected_at)}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Explanation */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 ring-1 ring-blue-100"
        >
          <div className="flex items-start gap-2.5">
            <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-bold uppercase tracking-widest text-blue-500 mb-1">How It Works</p>
              <p className="text-[13px] leading-relaxed text-slate-600">
                NASA FIRMS satellites detect thermal anomalies (hotspots) globally. When a detection falls within any monitored reserve boundary,
                a geo-fence alert is triggered. Alerts are deduplicated within 2 hours and expire after 24 hours.
                Confidence is classified as High, Nominal, or Low based on the satellite sensor quality.
              </p>
            </div>
          </div>
        </motion.div>
      </aside>

      {/* MAP */}
      <main className="flex-1 relative overflow-hidden bg-slate-900">
        <GeoFenceMap selectedAlert={selectedAlert} />
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-30 rounded-2xl bg-white/95 backdrop-blur-md px-6 py-4 shadow-2xl ring-1 ring-slate-200/80"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-[14px] font-bold text-slate-800">{selectedAlert.zone_name}</p>
                  <p className="text-[12px] text-slate-500">{selectedAlert.date}</p>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">FRP</p>
                <p className="text-[16px] font-bold tabular-nums text-slate-800">{selectedAlert.frp.toFixed(1)} MW</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Brightness</p>
                <p className="text-[16px] font-bold tabular-nums text-slate-800">{selectedAlert.brightness.toFixed(0)}K</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
