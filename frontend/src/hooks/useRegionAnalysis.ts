"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/constants";
import type { RegionAnalysisResponse } from "@/lib/regionTypes";

async function fetchRegionAnalysis(region: string): Promise<RegionAnalysisResponse> {
  const res = await fetch(api(`/api/v1/region-analysis/${region}`));
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to fetch region analysis");
  }
  return res.json();
}

export function useRegionAnalysis(region: string | null) {
  return useQuery({
    queryKey: ["region-analysis", region],
    queryFn: () => {
      console.log(`[RegionAnalysis] Fetching data for region: ${region}`);
      return fetchRegionAnalysis(region!);
    },
    enabled: region !== null && region.length > 0,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
}
