"use client";

import { motion } from "framer-motion";
import { Cpu, Zap } from "lucide-react";
import type { RegionAnalysisResponse } from "@/lib/regionTypes";

export default function ModelInfo({ model }: { model: RegionAnalysisResponse["model"] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl bg-white ring-1 ring-slate-200/60 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="h-3.5 w-3.5 text-blue-600" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Model Info</p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-[12px] text-slate-500">Algorithm</span>
          <span className="text-[12px] font-semibold text-slate-700">{model.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[12px] text-slate-500">Type</span>
          <span className="text-[12px] font-semibold text-slate-700">{model.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[12px] text-slate-500">Features</span>
          <span className="text-[12px] font-semibold text-slate-700">{model.feature_count}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="text-[11px] text-slate-400">Inference &lt; 100ms</span>
        </div>
      </div>
    </motion.div>
  );
}
