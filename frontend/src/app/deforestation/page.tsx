"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import { Trees, Map, Activity, Calendar } from "lucide-react";

const NDVI_MAP_YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025];

interface Zone {
  id: number; name: string; type: string; state?: string;
}

const NDVIMap = dynamic(() => import("@/components/map/NDVIMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-800"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>,
});

export default function DeforestationPage() {
  const { isAuthenticated, isLoading, getHeaders } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [leftYear, setLeftYear] = useState(2005);
  const [rightYear, setRightYear] = useState(2025);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(api("/api/v1/admin/zones"), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((z: Zone[]) => {
        const reserves = z.filter((x: Zone) => x.type === "reserve");
        setZones(reserves);
        if (reserves.length > 0) {
          setZoneId(reserves[0].id);
          setZoneName(reserves[0].name);
        }
      });
  }, [isAuthenticated, getHeaders]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0F172A]">
      <aside className="w-[360px] shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            <Trees className="h-5 w-5 text-emerald-600" />
            <h1 className="text-[18px] font-bold text-slate-900">Deforestation Monitor</h1>
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            Compare vegetation health using NASA MODIS calibrated true-color satellite imagery (250m resolution).
            Dark green areas indicate dense forest. Brown/red patches indicate deforestation or bare soil.
          </p>
        </motion.div>

        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Select Reserve</p>
          <div className="space-y-1">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => { setZoneId(z.id); setZoneName(z.name); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-[13px] ${
                  zoneId === z.id ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "text-slate-600 hover:bg-emerald-50"
                }`}
              >
                <Map className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium truncate">{z.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Comparison Years</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Baseline</p>
              <select value={leftYear} onChange={(e) => setLeftYear(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-bold text-slate-700">
                {NDVI_MAP_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Compare</p>
              <select value={rightYear} onChange={(e) => setRightYear(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[13px] font-bold text-emerald-700">
                {NDVI_MAP_YEARS.filter((y) => y > leftYear).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 ring-1 ring-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Layer Guide</p>
          </div>
          {[
            { color: "#166534", label: "Dense forest" },
            { color: "#16A34A", label: "Vegetation" },
            { color: "#CA8A04", label: "Sparse / Cropland" },
            { color: "#B45309", label: "Bare soil / Urban" },
            { color: "#7C2D12", label: "Deforested / Water" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded" style={{ background: item.color }} />
              <span className="text-[12px] font-medium text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Data Source</p>
          <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
            NASA GIBS MODIS/Terra Corrected Reflectance (True Color). 250m resolution, 16-day composites, calibrated for consistent comparison across years (2000–present).
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-300">{zoneName || "Select a reserve"}</span>
            <span className="text-[12px] text-slate-500">{leftYear} vs {rightYear} ({rightYear - leftYear}y gap)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setLeftYear(2005); setRightYear(2025); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">20-Year View</button>
            <button onClick={() => setRightYear((y) => Math.max(leftYear + 2, y - 2))} className="rounded-lg bg-slate-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700">Prev Period</button>
          </div>
        </div>

        <div className="flex-1 flex">
          <div className="w-1/2 border-r border-slate-700">
            <NDVIMap year={leftYear} zoneId={zoneId} side="left" onYearChange={(d) => setLeftYear((y) => Math.max(2005, Math.min(2025, y + d)))} />
          </div>
          <div className="w-1/2">
            <NDVIMap year={rightYear} zoneId={zoneId} side="right" onYearChange={(d) => setRightYear((y) => Math.max(2005, Math.min(2025, y + d)))} />
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400">Zone</p><p className="text-[13px] font-medium text-white">{zoneName || "—"}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400">Resolution</p><p className="text-[13px] font-medium text-white">250m (MODIS)</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-slate-400">Period</p><p className="text-[13px] font-medium text-white">{rightYear - leftYear} years</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">Green = healthy vegetation | Brown/red = deforestation</span>
            <div className="h-4 w-24 rounded" style={{ background: "linear-gradient(to right, #DC2626, #F97316, #F59E0B, #16A34A, #166534)" }} />
          </div>
        </div>
      </main>
    </div>
  );
}
