"use client";

import { useAppStore } from "@/stores/appStore";
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

export default function PredictionModal() {
  const selectedPoint = useAppStore((state) => state.selectedPoint);
  const predictionMode = useAppStore((state) => state.predictionMode);
  const { data: prediction, isLoading, error } = usePrediction(
    selectedPoint?.lat ?? null,
    selectedPoint?.lon ?? null,
  );
  const open = predictionMode && selectedPoint !== null;
  const risk = prediction?.wildfire_risk ?? 0;
  const tier = riskTier(risk);

  const closeModal = () => {
    useAppStore.setState({ predictionMode: false, selectedPoint: null });
  };

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
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={closeModal} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>

            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Point Analysis</p>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : error ? (
              <p className="py-6 text-center text-[13px] text-red-600">
                Prediction could not be loaded. Please try another location.
              </p>
            ) : prediction?.water_body ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-6 text-center">
                <div className="rounded-full bg-blue-100 p-3">
                  <Droplets className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">Water Body Detected</h3>
                  <p className="mt-1 text-[12px] text-slate-500">{prediction.message ?? "Fire predictions are disabled over water."}</p>
                </div>
              </div>
            ) : prediction && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint!.lat.toFixed(4)}, {selectedPoint!.lon.toFixed(4)}
                  </span>
                </div>

                {selectedPoint!.featureName && (
                  <p className="text-[12px] text-slate-500">{selectedPoint!.featureName}</p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Metric icon={<Thermometer className="mx-auto mb-1 h-3.5 w-3.5 text-orange-500" />} value={`${prediction.temperature ?? "—"}°C`} />
                  <Metric icon={<Droplets className="mx-auto mb-1 h-3.5 w-3.5 text-blue-500" />} value={`${prediction.humidity ?? "—"}%`} />
                  <Metric icon={<Wind className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-500" />} value={`${prediction.wind ?? "—"} m/s`} />
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] text-slate-500">Fire Risk</span>
                    <span className="text-[13px] font-semibold text-slate-700">{riskLabel(risk)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, risk)}%`, backgroundColor: RISK_COLORS[tier] }} />
                    </div>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: RISK_COLORS[tier] }}>{risk.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[12px] text-blue-700"><strong>{riskLabel(risk)}</strong> — live point-model prediction</span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-center">{icon}<div className="text-[13px] font-semibold text-slate-800">{value}</div></div>;
}
