"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAlerts } from "@/hooks/useAlerts";
import type { Alert } from "@/hooks/useAlerts";

interface Props {
  selectedAlert: Alert | null;
}

export default function GeoFenceMap({ selectedAlert }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayer = useRef<L.GeoJSON | null>(null);
  const markersLayer = useRef<L.LayerGroup>(L.layerGroup());
  const initialized = useRef(false);
  const { data: alerts } = useAlerts();

  useEffect(() => {
    if (!container.current || initialized.current) return;
    initialized.current = true;

    const map = L.map(container.current, {
      center: [23.5, 80],
      zoom: 5,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
    }).addTo(map);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
      opacity: 0.3,
    }).addTo(map);

    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    markersLayer.current.addTo(map);

    fetch("/forestReserves.geojson")
      .then((r) => r.json())
      .then((data) => {
        if (!mapRef.current) return;
        const layer = L.geoJSON(data as never, {
          style: () => ({
            color: "#16A34A",
            weight: 2.5,
            fillColor: "#22C55E",
            fillOpacity: 0.12,
            dashArray: "6 3",
          }),
          onEachFeature: (feature, l) => {
            const props = (feature as { properties?: Record<string, string> }).properties;
            if (props?.name) {
              l.bindTooltip(props.name, { permanent: false, direction: "center" });
            }
          },
        });
        layer.addTo(mapRef.current);
        geoLayer.current = layer;
        mapRef.current.fitBounds(layer.getBounds(), { padding: [50, 50] });
      });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      initialized.current = false;
    };
  }, []);

  useEffect(() => {
    markersLayer.current.clearLayers();
    if (!alerts || alerts.length === 0) return;

    alerts.forEach((a) => {
      const el = document.createElement("div");
      el.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:#DC2626;border:3px solid white;box-shadow:0 0 10px rgba(220,38,38,0.6);animation:pulse-fire 2s infinite;cursor:pointer"></div>`;

      const marker = L.marker([a.lat, a.lon], {
        icon: L.divIcon({ html: el.innerHTML, className: "", iconSize: [16, 16], iconAnchor: [8, 8] }),
        zIndexOffset: 1000,
      });

      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:13px;line-height:1.6;color:#1E293B">
          <b style="color:#DC2626">${a.zone_name}</b><br/>
          FRP: ${a.frp.toFixed(1)} MW &middot; ${a.brightness.toFixed(0)}K<br/>
          Confidence: ${a.confidence.toUpperCase()} &middot; ${a.date}
        </div>`,
        { direction: "top", offset: [0, -10] }
      );

      marker.addTo(markersLayer.current);
    });
  }, [alerts]);

  useEffect(() => {
    if (!mapRef.current || !selectedAlert) return;
    mapRef.current.flyTo([selectedAlert.lat, selectedAlert.lon], 14, { duration: 1 });
  }, [selectedAlert]);

  return <div ref={container} className="h-full w-full" />;
}
