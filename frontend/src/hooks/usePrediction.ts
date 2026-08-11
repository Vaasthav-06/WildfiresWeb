"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/constants";

async function fetchPrediction(lat: number, lon: number) {
  const res = await fetch(api(`/api/v1/predict?lat=${lat}&lon=${lon}`));
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
}

export function usePrediction(lat: number | null, lon: number | null) {
  return useQuery({
    queryKey: ["prediction", lat, lon],
    queryFn: () => fetchPrediction(lat!, lon!),
    enabled: lat !== null && lon !== null,
    staleTime: 60_000,
  });
}
