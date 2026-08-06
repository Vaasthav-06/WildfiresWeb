"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/constants";
import { motion } from "framer-motion";
import {
  Trees, ChevronLeft, ChevronRight, Map, TrendingDown,
  TrendingUp, Activity, Calendar, BarChart3, ZoomIn,
} from "lucide-react";

const NDVI_MAP_YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025];

interface Zone {
  id: number; name: string; type: string; state?: string;
  lat_min?: number; lat_max?: number; lon_min?: number; lon_max?: number;
}

function NDVIMap({
  year, zone, side, onYearChange,
}: {
  year: number; zone: Zone | null; side: "left" | "right";
  onYearChange: (d: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ndviLayer = useRef<L.TileLayer | null>(null);
  const geoLayer = useRef<L.GeoJSON | null>(null);
  const initialized = useRef(false);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    import("leaflet").then((mod) => {
      setL(mod.default || mod);
      import("leaflet/dist/leaflet.css");
    });
  }, []);

  useEffect(() => {
    if (!L || !container.current || initialized.current) return;
    initialized.current = true;

    const map = L.map(container.current, {
      center: [23.5, 80],
      zoom: 6,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OSM", maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; initialized.current = false; };
  }, [L]);

  useEffect(() => {
    if (!L || !mapRef.current) return;
    if (ndviLayer.current) mapRef.current.removeLayer(ndviLayer.current);

    const date = `${year}-07-01`;
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_16Day/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

    ndviLayer.current = L.tileLayer(url, {
      attribution: "NASA GIBS MODIS NDVI",
      opacity: 0.7,
      maxZoom: 12,
    }).addTo(mapRef.current);
  }, [year, L]);

  useEffect(() => {
    if (!L || !mapRef.current || !zone) return;
    if (geoLayer.current) mapRef.current.removeLayer(geoLayer.current);

    fetch(api(`/api/v1/admin/zones/${zone.id}/geojson`), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("wf_token") || ""}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((geom) => {
        if (!geom || !mapRef.current) return;
        const layer = L.geoJSON(geom as never, {
          style: { color: "#F97316", weight: 3, fillColor: "#F97316", fillOpacity: 0.1, dashArray: "6 3" },
        });
        layer.addTo(mapRef.current);
        mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30] });
        geoLayer.current = layer;
      });
  }, [zone, L]);

  return (
    <div className="relative flex-1">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => onYearChange(-2)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
        </button>
        <span className="rounded-lg bg-white px-3 py-1 text-[13px] font-bold tabular-nums text-slate-700 shadow ring-1 ring-slate-200">
          {year}
        </span>
        <button
          onClick={() => onYearChange(2)}
          disabled={year >= 2025}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        </button>
      </div>
      <div className="absolute top-3 right-3 z-10 rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-400 shadow ring-1 ring-slate-200 backdrop-blur">
        {side === "left" ? "BASELINE" : "COMPARISON"}
      </div>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

export default function DeforestationPage() {
  const { isAuthenticated, isLoading, getHeaders } = useAuth();
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [leftYear, setLeftYear] = useState(2005);
  const [rightYear, setRightYear] = useState(2025);
  const [activeTab, setActiveTab] = useState<"compare" | "trend">("compare");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(api("/api/v1/admin/zones"), { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((z: Zone[]) => {
        setZones(z.filter((x) => x.type === "reserve"));
        if (z.length > 0) setSelectedZone(z[0]);
      });
  }, [isAuthenticated, getHeaders]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const ndviDiff = null; // Placeholder for NDVI statistics

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0F172A]">
      {/* Sidebar */}
      <aside className="w-[380px] shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            <Trees className="h-5 w-5 text-emerald-600" />
            <h1 className="text-[18px] font-bold text-slate-900">Deforestation Monitor</h1>
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            Compare vegetation health across forest reserves using NASA MODIS NDVI satellite data (250m resolution).
            Each map shows the Normalized Difference Vegetation Index for the selected year.
          </p>
        </motion.div>

        {/* Zone Selector */}
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Select Reserve</p>
          <div className="space-y-1">
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-[13px] ${
                  selectedZone?.id === z.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                    : "text-slate-600 hover:bg-emerald-50"
                }`}
              >
                <Map className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium truncate">{z.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Year Selectors */}
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Comparison Years</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Baseline</p>
              <select
                value={leftYear}
                onChange={(e) => setLeftYear(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-bold text-slate-700"
              >
                {NDVI_MAP_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Compare</p>
              <select
                value={rightYear}
                onChange={(e) => setRightYear(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[13px] font-bold text-emerald-700"
              >
                {NDVI_MAP_YEARS.filter((y) => y > leftYear).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* NDVI Reference */}
        <div className="mt-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 ring-1 ring-emerald-100">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">NDVI Guide</p>
          </div>
          <div className="space-y-2">
            {[
              { range: "0.6 – 1.0", label: "Dense vegetation", color: "#166534" },
              { range: "0.3 – 0.6", label: "Moderate vegetation", color: "#16A34A" },
              { range: "0.1 – 0.3", label: "Sparse vegetation", color: "#F59E0B" },
              { range: "-0.1 – 0.1", label: "Bare soil / Urban", color: "#F97316" },
              { range: "< -0.1", label: "Water / No vegetation", color: "#DC2626" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded" style={{ background: item.color }} />
                <span className="text-[11px] text-slate-500">{item.range}</span>
                <span className="text-[12px] font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Source */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Data Source</p>
          <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
            NASA GIBS MODIS/Terra Vegetation Indices (MOD13Q1). 16-day composites at 250m resolution.
            Data available from February 2000 to present.
          </p>
        </div>
      </aside>

      {/* Dual Map Area */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-300">
              {selectedZone?.name || "Select a reserve"}
            </span>
            <span className="text-[12px] text-slate-500">
              {leftYear} vs {rightYear} ({rightYear - leftYear} year gap)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLeftYear(2005);
                setRightYear(2025);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
            >
              20-Year View
            </button>
            <button
              onClick={() => {
                setLeftYear(NDVI_MAP_YEARS[NDVI_MAP_YEARS.indexOf(rightYear) - 1] || 2023);
              }}
              className="rounded-lg bg-slate-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700"
            >
              Previous Period
            </button>
          </div>
        </div>

        {/* Dual maps */}
        <div className="flex-1 flex">
          <div className="w-1/2 border-r border-slate-700">
            <NDVIMap year={leftYear} zone={selectedZone} side="left" onYearChange={(d) => setLeftYear((y) => Math.max(2005, Math.min(2025, y + d)))} />
          </div>
          <div className="w-1/2">
            <NDVIMap year={rightYear} zone={selectedZone} side="right" onYearChange={(d) => setRightYear((y) => Math.max(2005, Math.min(2025, y + d)))} />
          </div>
        </div>

        {/* Bottom stats */}
        {selectedZone && (
          <div className="px-5 py-3 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Zone</p>
                <p className="text-[13px] font-medium text-white">{selectedZone.name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Resolution</p>
                <p className="text-[13px] font-medium text-white">250m (MODIS)</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Period</p>
                <p className="text-[13px] font-medium text-white">{rightYear - leftYear} years</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">Darker green = healthier vegetation</span>
              <div className="h-4 w-24 rounded" style={{ background: "linear-gradient(to right, #DC2626, #F97316, #F59E0B, #16A34A, #166534)" }} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
