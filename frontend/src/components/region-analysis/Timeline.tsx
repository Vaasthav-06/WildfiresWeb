"use client";

import { motion } from "framer-motion";
import { CloudSun, Cpu } from "lucide-react";

interface Props {
  lastUpdated: string;
  weatherUpdated?: string;
}

export default function Timeline({ lastUpdated, weatherUpdated }: Props) {
  const items = [
    {
      icon: CloudSun,
      label: "Weather Updated",
      time: weatherUpdated || formatAgo(lastUpdated),
      color: "text-sky-500",
      bg: "bg-sky-50",
    },
    {
      icon: Cpu,
      label: "Prediction Generated",
      time: formatAgo(lastUpdated),
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Timeline</p>
      <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.25 }}
            className="relative"
          >
            <div className={`absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full ${item.bg} ring-2 ring-white`}>
              <item.icon className={`h-2.5 w-2.5 ${item.color}`} />
            </div>
            <p className="text-[12px] font-medium text-slate-700">{item.label}</p>
            <p className="text-[11px] text-slate-400">{item.time}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function formatAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "Unknown";
  }
}
