"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Trees, MapPin, Calendar, Mountain } from "lucide-react";
import { REGIONS, getRegion } from "@/lib/regions";
import { useRegionAnalysis } from "@/hooks/useRegionAnalysis";
import RegionSelector from "@/components/region-analysis/RegionSelector";
import RiskCard from "@/components/region-analysis/RiskCard";
import WeatherPanel from "@/components/region-analysis/WeatherPanel";
import FeatureImportance from "@/components/region-analysis/FeatureImportance";
import ModelInfo from "@/components/region-analysis/ModelInfo";
import Timeline from "@/components/region-analysis/Timeline";
import PredictionExplanation from "@/components/region-analysis/PredictionExplanation";
import { Skeleton, ErrorState, EmptyState } from "@/components/region-analysis/LoadingStates";
import { PANEL } from "@/lib/constants";
import PredictionModal from "@/components/overlays/PredictionModal";

const RegionMap = dynamic(() => import("@/components/region-analysis/RegionMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-slate-200" />,
});

export default function RegionAnalysisPage() {
  const [selected, setSelected] = useState<string>("corbett");
  const { data, isLoading, error, refetch } = useRegionAnalysis(selected);
  const region = getRegion(selected);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-slate-200 bg-[#F8FAFC] p-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Region Analysis</h1>
          <p className="mt-1 text-[12px] text-slate-500">CNN-supported ML predictions for monitored reserves</p>
        </motion.div>

        <div className="mt-5">
          <RegionSelector 
            active={selected} 
            onChange={(newRegion) => {
              import("@/stores/appStore").then(({ useAppStore }) => {
                useAppStore.getState().setSelectedPoint(null);
                useAppStore.getState().setPredictionMode(false);
              });
              setSelected(newRegion);
            }} 
          />
        </div>

        {region && (
          <motion.div
            key={selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-5 space-y-4"
          >
            {/* Region meta */}
            <div className="rounded-xl bg-white ring-1 ring-slate-200/60 p-4">
              <h2 className="text-[14px] font-bold text-slate-800">{region.name}</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{region.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{region.state}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trees className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{region.area_sq_km} km²</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{region.fire_season}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mountain className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500 truncate">{region.elevation}</span>
                </div>
              </div>
            </div>

            {/* Data section */}
            {isLoading && <Skeleton />}
            {error && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}

            {data && (
              <>
                <RiskCard label={data.risk.label} probability={data.risk.probability} confidence={data.risk.confidence} />
                <WeatherPanel weather={data.weather} />
                <FeatureImportance items={data.feature_importance} />
                <PredictionExplanation text={data.explanation} />
                <ModelInfo model={data.model} />
                <Timeline lastUpdated={data.last_updated} />
              </>
            )}
          </motion.div>
        )}
      </aside>

      {/* MAIN MAP AREA */}
      <main className="flex-1 relative overflow-hidden bg-slate-900">
        {region ? (
          <RegionMap
            key={selected}
            regionId={selected}
            center={[region.center.lat, region.center.lon]}
            bounds={[
              [region.bounds.lat_min, region.bounds.lon_min],
              [region.bounds.lat_max, region.bounds.lon_max],
            ]}
          />
        ) : (
          <EmptyState />
        )}

        {/* Overlay label */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 z-30 rounded-xl bg-white/90 backdrop-blur-md px-5 py-3 shadow-lg ring-1 ring-slate-200/80"
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Risk Assessment</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${
                  data.risk.label === "Extreme" ? "bg-purple-600" :
                  data.risk.label === "Very High" ? "bg-red-600" :
                  data.risk.label === "High" ? "bg-orange-600" :
                  data.risk.label === "Moderate" ? "bg-amber-500" : "bg-emerald-600"
                }`}
              >
                {data.risk.label}
              </span>
              <span className="text-[12px] font-mono tabular-nums text-slate-600">{data.risk.probability.toFixed(1)}%</span>
            </div>
          </motion.div>
        )}
        <PredictionModal />
      </main>
    </div>
  );
}
