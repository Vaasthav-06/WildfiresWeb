"use client";

import { REGIONS } from "@/lib/regions";
import { Trees } from "lucide-react";

interface Props {
  active: string;
  onChange: (id: string) => void;
}

export default function RegionSelector({ active, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">ML Regions</p>
      {REGIONS.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
            active === r.id
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-white text-slate-600 hover:bg-blue-50/50 ring-1 ring-slate-200/60"
          }`}
        >
          <Trees className={`h-4 w-4 shrink-0 mt-0.5 ${active === r.id ? "text-blue-200" : "text-emerald-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight">{r.name}</p>
            <p className={`text-[11px] mt-0.5 ${active === r.id ? "text-blue-200" : "text-slate-400"}`}>
              {r.state} · {r.area_sq_km} km²
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
