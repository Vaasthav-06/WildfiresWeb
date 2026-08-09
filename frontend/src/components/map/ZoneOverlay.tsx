"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { api } from "@/lib/constants";

const ZONE_COLORS: Record<string, string> = {
  reserve: "#2563EB",
  buffer_zone: "#F59E0B",
  core_forest: "#16A34A",
  eco_sensitive: "#7C3AED",
  beat_boundary: "#64748B",
  compartment: "#0EA5E9",
};

interface Props {
  map: L.Map | null;
  visible: boolean;
  token: string | null;
}

export default function ZoneOverlay({ map, visible, token }: Props) {
  const layerRef = useRef<L.GeoJSON | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!map || loaded.current || !token) return;
    loaded.current = true;

    fetch(api("/api/v1/admin/zones"), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(async (zones: Array<{ id: number; name: string; type: string }>) => {
        const features: Array<object> = [];
        for (const z of zones) {
          try {
            const r = await fetch(api(`/api/v1/admin/zones/${z.id}/geojson`), {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!r.ok) continue;
            const geom = await r.json();
            features.push({
              type: "Feature",
              properties: { id: z.id, name: z.name, type: z.type },
              geometry: geom,
            });
          } catch {}
        }

        const layer = L.geoJSON(
          { type: "FeatureCollection", features } as never,
          {
            style: (feature) => {
              if (!feature || !("properties" in feature)) return {};
              const props = feature.properties as Record<string, string>;
              const color = ZONE_COLORS[props.type] || "#94A3B8";
              const weight = props.type === "reserve" ? 3 : props.type === "core_forest" ? 2 : 1;
              const dash = props.type === "buffer_zone" ? "6 3" : props.type === "eco_sensitive" ? "4 4" : undefined;
              return {
                color, weight, fillColor: color, fillOpacity: 0.08,
                dashArray: dash,
              };
            },
          }
        );
        layerRef.current = layer;
        if (visible) layer.addTo(map);
      });
  }, [map]);

  useEffect(() => {
    if (!map || !layerRef.current) return;
    if (visible && !map.hasLayer(layerRef.current)) layerRef.current.addTo(map);
    if (!visible) map.removeLayer(layerRef.current);
  }, [map, visible]);

  return null;
}
