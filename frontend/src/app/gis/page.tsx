"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import {
  Map, Layers, BarChart3, Users, Trees, Shield,
  AlertTriangle, Database, Activity, ChevronRight, Home,
} from "lucide-react";

interface Zone {
  id: number; name: string; type: string; state?: string;
  area_ha?: number; metadata: Record<string, unknown>;
}
interface Stats { zones: number; users: number; alerts: number }

const PORTAL_TABS = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "boundaries", label: "Boundaries", icon: Map },
  { key: "alerts", label: "Alerts", icon: AlertTriangle },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const ZONE_LABELS: Record<string, string> = {
  reserve: "Reserve",
  buffer_zone: "Buffer Zone",
  core_forest: "Core Forest",
  eco_sensitive: "Eco-Sensitive Area",
  beat_boundary: "Beat Boundary",
  compartment: "Compartment",
};

const ZONE_COLORS: Record<string, string> = {
  reserve: "bg-blue-100 text-blue-700",
  buffer_zone: "bg-amber-100 text-amber-700",
  core_forest: "bg-emerald-100 text-emerald-700",
  eco_sensitive: "bg-purple-100 text-purple-700",
  beat_boundary: "bg-slate-100 text-slate-600",
  compartment: "bg-sky-100 text-sky-700",
};

export default function GISPortalPage() {
  const { user, isAuthenticated, isLoading, logout, getHeaders } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [zones, setZones] = useState<Zone[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  const fetchData = useCallback(async () => {
    const [zRes, sRes] = await Promise.all([
      fetch(api("/api/v1/admin/zones"), { headers: getHeaders() }),
      fetch(api("/api/v1/admin/stats"), { headers: getHeaders() }),
    ]);
    if (zRes.ok) {
      const z = await zRes.json();
      setZones(z);
      const visibility: Record<string, boolean> = {};
      z.forEach((zone: Zone) => { visibility[zone.id] = true; });
      setLayerVisibility(visibility);
    }
    if (sRes.ok) setStats(await sRes.json());
  }, [getHeaders]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  const toggleLayer = (id: number) => {
    setLayerVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const zonesByType = zones.reduce((acc: Record<string, Zone[]>, z: Zone) => {
    (acc[z.type] = acc[z.type] || []).push(z);
    return acc;
  }, {});

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900">Web GIS Decision Support Platform</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Forest boundary visualisation · GIS layer management · Analytical reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-400">{user?.email} ({user?.role})</span>
            <button onClick={logout} className="text-[12px] font-medium text-slate-500 hover:text-red-600">Logout</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 flex gap-0">
          {PORTAL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Zones", value: stats.zones, icon: Map, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "GIS Layers", value: Object.keys(zonesByType).length, icon: Layers, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Active Alerts", value: stats.alerts, icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "Users", value: stats.users, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
                    <s.icon className={`h-5 w-5 ${s.color} mb-3`} />
                    <p className="text-[32px] font-black tabular-nums text-slate-800">{s.value}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Zone hierarchy summary */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200/60 p-6">
              <h2 className="text-[14px] font-bold text-slate-800 mb-4">Forest Management Hierarchy</h2>
              <div className="grid grid-cols-3 gap-4">
                {["reserve", "buffer_zone", "core_forest", "eco_sensitive", "beat_boundary", "compartment"].map((ztype) => (
                  <div key={ztype} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ZONE_COLORS[ztype] || "bg-slate-100 text-slate-600"}`}>
                        {ZONE_LABELS[ztype] || ztype}
                      </span>
                      <span className="text-[20px] font-bold tabular-nums text-slate-700">
                        {(zonesByType[ztype] || []).length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(zonesByType[ztype] || []).slice(0, 3).map((z) => (
                        <p key={z.id} className="text-[11px] text-slate-500 truncate">{z.name}</p>
                      ))}
                      {(zonesByType[ztype] || []).length > 3 && (
                        <p className="text-[10px] text-slate-400">+{(zonesByType[ztype] || []).length - 3} more</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Boundaries Tab */}
        {tab === "boundaries" && (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {Object.entries(ZONE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded ${key === "reserve" ? "bg-blue-500" : key === "buffer_zone" ? "bg-amber-500" : key === "core_forest" ? "bg-emerald-500" : key === "eco_sensitive" ? "bg-purple-500" : key === "beat_boundary" ? "bg-slate-400" : "bg-sky-400"}`} />
                  <span className="text-[12px] text-slate-600">{label}</span>
                </div>
              ))}
            </div>

            {/* Zone-type sections */}
            {Object.entries(zonesByType).map(([ztype, zoneList]) => (
              <div key={ztype} className="rounded-xl bg-white ring-1 ring-slate-200/60 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Trees className="h-4 w-4 text-slate-500" />
                    <span className="text-[13px] font-semibold text-slate-700">{ZONE_LABELS[ztype] || ztype}s</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">{zoneList.length}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {zoneList.map((z) => (
                    <div key={z.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleLayer(z.id)}
                          className={`h-4 w-4 rounded border-2 transition-colors ${layerVisibility[z.id] ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}
                        />
                        <div>
                          <p className="text-[13px] font-medium text-slate-700">{z.name}</p>
                          <p className="text-[11px] text-slate-400">{z.state || ""} {z.area_ha ? `· ${(z.area_ha/1000).toFixed(1)}k ha` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {z.metadata?.forest_type ? (
                          <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{String(z.metadata.forest_type)}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alerts Tab */}
        {tab === "alerts" && (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200/60 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-[14px] font-bold text-slate-800">Geo-Fence Alert History</h2>
            </div>
            <p className="text-[13px] text-slate-500 mb-4">
              Fire detection alerts triggered within monitored forest boundaries. Alerts are generated when NASA FIRMS satellite
              detections fall within geo-fence zones.
            </p>
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <Database className="mx-auto h-6 w-6 text-slate-300 mb-2" />
              <p className="text-[13px] text-slate-500">{stats?.alerts || 0} alerts recorded in database</p>
              <p className="text-[11px] text-slate-400 mt-1">Alert data persists across container restarts via NeonDB Postgres.</p>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200/60 p-6">
              <h2 className="text-[14px] font-bold text-slate-800 mb-4">Zone Distribution by State</h2>
              <div className="space-y-3">
                {Object.entries(
                  zones.reduce((acc: Record<string, number>, z: Zone) => {
                    const state = z.state || "Unknown";
                    acc[state] = (acc[state] || 0) + 1;
                    return acc;
                  }, {})
                ).sort(([, a], [, b]) => b - a).map(([state, count]) => (
                  <div key={state} className="flex items-center gap-3">
                    <span className="w-28 text-[12px] font-medium text-slate-600">{state}</span>
                    <div className="flex-1 h-5 rounded-md bg-slate-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / zones.length) * 100}%` }}
                        className="h-full rounded-md bg-blue-600"
                      />
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-slate-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white ring-1 ring-slate-200/60 p-6">
              <h2 className="text-[14px] font-bold text-slate-800 mb-4">System Status</h2>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Database</span><span className="font-medium text-emerald-600">NeonDB Postgres + PostGIS</span></div>
                <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Spatial Index</span><span className="font-medium text-emerald-600">GiST (zones, alerts)</span></div>
                <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">Auth Method</span><span className="font-medium text-slate-700">JWT HS256</span></div>
                <div className="flex justify-between py-2 border-b border-slate-50"><span className="text-slate-500">GIS Layers</span><span className="font-medium text-slate-700">6 types, {zones.length} zones</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
