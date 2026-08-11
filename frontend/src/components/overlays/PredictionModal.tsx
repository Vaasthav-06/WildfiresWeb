"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { useHeatmap } from "@/hooks/useHeatmap";
import { usePrediction } from "@/hooks/usePrediction";
import { PANEL, RISK_COLORS } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, Thermometer, Droplets, Wind, MapPin, Activity, Waves } from "lucide-react";

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
  return { point: best, distDeg: Math.sqrt(bestDist) };
}

export default function PredictionModal() {
  const selectedPoint = useAppStore((s) => s.selectedPoint);
  const predictionMode = useAppStore((s) => s.predictionMode);
  const { data: heatmap } = useHeatmap();
  const { data: weather } = usePrediction(selectedPoint?.lat ?? null, selectedPoint?.lon ?? null);
  const open = predictionMode && selectedPoint !== null;

  const closeModal = () => {
    useAppStore.setState({ predictionMode: false, selectedPoint: null });
  };

  const result = useMemo(() => {
    if (!selectedPoint || !heatmap?.points?.length) return null;
    const r = findNearest(selectedPoint.lat, selectedPoint.lon, heatmap.points);
    const isSea = r.distDeg > 1.0;
    return { ...r, isSea };
  }, [selectedPoint, heatmap]);

  const nearest = result?.point;
  const isSea = result?.isSea ?? false;
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
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`${PANEL} relative w-80 p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={closeModal} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>

            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Point Analysis</p>

            {!nearest && !isSea ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : weather?.water_body ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="rounded-full bg-blue-100 p-3">
                  <Droplets className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">Water Body Detected</h3>
                  <p className="mt-1 text-[12px] text-slate-500">Fire predictions are disabled for coordinates located over water.</p>
                </div>
              </div>
            ) : isSea ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint!.lat.toFixed(4)}, {selectedPoint!.lon.toFixed(4)}
                  </span>
                </div>

                <div className="rounded-lg bg-blue-50 p-5 flex flex-col items-center text-center">
                  <Waves className="h-8 w-8 text-blue-400 mb-3" />
                  <p className="text-[14px] font-bold text-blue-700">Sea / Ocean Area</p>
                  <p className="mt-1 text-[12px] text-blue-500 leading-relaxed">
                    No land data available at this location. The nearest heatmap point is {(result!.distDeg * 111).toFixed(0)} km away.
                    Please click on a land area for fire risk analysis.
                  </p>
                </div>

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
              </div>
            ) : null}

            {nearest && !isSea && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint!.lat.toFixed(4)}, {selectedPoint!.lon.toFixed(4)}
                  </span>
                </div>

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
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
