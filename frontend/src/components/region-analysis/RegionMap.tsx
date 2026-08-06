"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  regionId: string;
  center: [number, number];
  bounds: L.LatLngBoundsExpression;
}

export default function RegionMap({ regionId, center, bounds }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rectRef = useRef<L.Rectangle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!container.current || initialized.current) return;
    initialized.current = true;

    const map = L.map(container.current, {
      center, zoom: 12,
      zoomControl: true, attributionControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri, Maxar", maxZoom: 19,
    }).addTo(map);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OSM", maxZoom: 19, opacity: 0.35,
    }).addTo(map);

    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });

    markerRef.current = L.circleMarker(center, {
      radius: 8, color: "#F97316", fillColor: "#F97316", fillOpacity: 0.35, weight: 3,
    }).addTo(map);

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; initialized.current = false; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (rectRef.current) mapRef.current.removeLayer(rectRef.current);

    const bnds = bounds as [[number, number], [number, number]];
    rectRef.current = L.rectangle(bnds, {
      color: "#16A34A", weight: 3, fillColor: "#22C55E", fillOpacity: 0.15,
      dashArray: "8 4",
    }).addTo(mapRef.current);
  }, [regionId]);

  return <div ref={container} className="h-full w-full rounded-2xl" />;
}
