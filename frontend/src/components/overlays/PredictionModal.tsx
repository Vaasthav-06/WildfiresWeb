"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { useHeatmap } from "@/hooks/useHeatmap";
import { usePrediction } from "@/hooks/usePrediction";
import { PANEL, RISK_COLORS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, Thermometer, Droplets, Wind, MapPin, Activity } from "lucide-react";

function riskTier(risk: number): keyof typeof RISK_COLORS {
  if (risk < 20) return "low";
  if (risk < 40) return "moderate";
  if (risk < 65) return "high";
  if (risk < 85) return "veryHigh";
  return "extreme";
}

function riskLabel(risk: number): string {
  if (risk < 20) return "Low";
  if (risk < 40) return "Moderate";
  if (risk < 65) return "High";
  if (risk < 85) return "Very High";
  return "Extreme";
}

function findNearest(lat: number, lon: number, points: Array<{ lat: number; lon: number; risk: number }>) {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

export default function PredictionModal() {
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  const setSelectedPoint = useAppStore((s) => s.setSelectedPoint);
  const predictionMode = useAppStore((s) => s.predictionMode);
  const { data: heatmap } = useHeatmap();
  const { data: weather } = usePrediction(selectedPoint?.lat ?? null, selectedPoint?.lon ?? null);
  const open = predictionMode && selectedPoint !== null;

  const nearest = useMemo(() => {
    if (!selectedPoint || !heatmap?.points?.length) return null;
    return findNearest(selectedPoint.lat, selectedPoint.lon, heatmap.points);
  }, [selectedPoint, heatmap]);

  const risk = nearest?.risk ?? 0;
  const tier = riskTier(risk);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm"
          onClick={() => setSelectedPoint(null)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`${PANEL} relative w-80 p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelectedPoint(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>

            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Point Analysis</p>

            {nearest ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint!.lat.toFixed(4)}, {selectedPoint!.lon.toFixed(4)}
                  </span>
                </div>

                {/* Weather */}
                {weather && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <Thermometer className="mx-auto mb-1 h-3.5 w-3.5 text-orange-500" />
                      <div className="text-[13px] font-semibold text-slate-800">{weather.temperature}°C</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <Droplets className="mx-auto mb-1 h-3.5 w-3.5 text-blue-500" />
                      <div className="text-[13px] font-semibold text-slate-800">{weather.humidity}%</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <Wind className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-500" />
                      <div className="text-[13px] font-semibold text-slate-800">{weather.wind} m/s</div>
                    </div>
                  </div>
                )}

                {/* Risk — from heatmap, matches overlay */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-slate-500">Fire Risk</span>
                    <span className="text-[13px] font-semibold text-slate-700">{riskLabel(risk)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, risk)}%`,
                          backgroundColor: RISK_COLORS[tier],
                        }}
                      />
                    </div>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: RISK_COLORS[tier] }}>
                      {risk.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[12px] text-blue-700">
                    <strong>{riskLabel(risk)}</strong> — matches heatmap overlay
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
