"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { api } from "@/lib/constants";

interface ZoneFeature { id: number; name: string; type: string; state?: string; geojson: string; ndvi_change: number; cover_change: number; trend: string; color: string }

interface Props {
  onZonesLoaded: (zones: ZoneFeature[]) => void;
  onZoneClick: (zone: ZoneFeature) => void;
  onCustomDraw: (swLat: number, swLng: number, neLat: number, neLng: number, geojson?: any) => void;
  visibleTrends: string[];
  basemap: "satellite" | "street" | "dark";
  searchedZoneId: number | null;
}

let mapDataPromise: Promise<ZoneFeature[]> | null = null;

function getMapData(): Promise<ZoneFeature[]> {
  mapDataPromise ??= fetch(api("/api/v1/deforestation/map-data"))
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);
  return mapDataPromise;
}

export default function DeforestationMap({ onZonesLoaded, onZoneClick, onCustomDraw, visibleTrends, basemap, searchedZoneId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const zoneLayersRef = useRef<L.LayerGroup | null>(null);
  const allZonesRef = useRef<ZoneFeature[]>([]);
  const basemapLayersRef = useRef<Record<string, L.TileLayer>>({});

  // Update visible layers when visibleTrends changes
  useEffect(() => {
    if (!mapRef.current || !zoneLayersRef.current) return;
    zoneLayersRef.current.clearLayers();
    const visible = allZonesRef.current.filter((z) => visibleTrends.includes(z.trend));
    visible.forEach((z) => {
      try {
        const isSearched = z.id === searchedZoneId;
        const layer = L.geoJSON(JSON.parse(z.geojson) as never, {
          style: {
            color: isSearched ? "#FCD34D" : z.color,
            weight: isSearched ? 4 : 2,
            fillColor: z.color,
            fillOpacity: isSearched ? 0.4 : 0.15
          },
        });
        
        layer.on("mouseover", (e) => {
          const l = e.target;
          l.setStyle({ weight: 4, fillOpacity: 0.4, color: isSearched ? "#FCD34D" : z.color });
          l.bringToFront();
        });
        layer.on("mouseout", (e) => {
          const l = e.target;
          if (z.id !== searchedZoneId) {
            l.setStyle({ weight: 2, fillOpacity: 0.15, color: z.color });
          }
        });

        layer.bindTooltip(
          `<div style="font-family:Inter;font-size:12px;line-height:1.5">
            <b style="color:#1E293B;font-size:13px">${z.name}</b><br/>
            <span style="color:${z.color};font-weight:600">${z.trend} (${(z.ndvi_change*100).toFixed(1)}%)</span>
          </div>`,
          { direction: "top", sticky: true, className: "backdrop-blur-md bg-white/90 border-0 shadow-lg rounded-lg p-2" }
        );
        layer.on("click", () => onZoneClick(z));
        layer.addTo(zoneLayersRef.current!);
      } catch {}
    });
  }, [visibleTrends, onZoneClick, searchedZoneId]);

  // Handle basemap changes
  useEffect(() => {
    if (!mapRef.current) return;
    const layers = basemapLayersRef.current;
    if (layers.satellite) mapRef.current.removeLayer(layers.satellite);
    if (layers.street) mapRef.current.removeLayer(layers.street);
    if (layers.dark) mapRef.current.removeLayer(layers.dark);
    
    if (layers[basemap]) {
      layers[basemap].addTo(mapRef.current);
      layers[basemap].bringToBack();
    }
  }, [basemap]);

  // Handle panning to searched zone
  useEffect(() => {
    if (!mapRef.current || !searchedZoneId) return;
    const z = allZonesRef.current.find(zone => zone.id === searchedZoneId);
    if (z) {
      try {
        const layer = L.geoJSON(JSON.parse(z.geojson) as never);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.flyToBounds(bounds, { padding: [100, 100], duration: 1.5 });
        }
      } catch {}
    }
  }, [searchedZoneId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    
    const map = L.map(containerRef.current, {
      center: [23.5, 80], zoom: 6,
      zoomControl: false, attributionControl: false,
      scrollWheelZoom: true,
    });
    
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri, Maxar", maxZoom: 19,
    });
    const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OSM", maxZoom: 19,
    });
    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "CartoDB", maxZoom: 19,
    });
    
    basemapLayersRef.current = { satellite, street, dark };
    satellite.addTo(map);

    mapRef.current = map;

    zoneLayersRef.current = L.layerGroup().addTo(map);
    drawnItemsRef.current = new L.FeatureGroup().addTo(map);

    const drawControl = new (L.Control as any).Draw({
      position: "topleft",
      edit: { featureGroup: drawnItemsRef.current, remove: true },
      draw: {
        polyline: false, circle: false, circlemarker: false, marker: false,
        polygon: { shapeOptions: { color: "#3B82F6", weight: 3, fillColor: "#3B82F6", fillOpacity: 0.2 } },
        rectangle: { shapeOptions: { color: "#3B82F6", weight: 3, fillColor: "#3B82F6", fillOpacity: 0.2 } },
      }
    });
    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      drawnItemsRef.current?.clearLayers();
      const layer = e.layer;
      drawnItemsRef.current?.addLayer(layer);
      
      const bounds = layer.getBounds();
      const geojson = layer.toGeoJSON();
      onCustomDraw(bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng, geojson.geometry);
    });
    
    map.on((L as any).Draw.Event.DELETED, () => {
      // Could trigger a clear action if needed
    });

    getMapData()
      .then((zones: ZoneFeature[]) => {
        const distinct = zones.filter((z) => z.type === "reserve");
        allZonesRef.current = distinct;
        onZonesLoaded(distinct);
        
        if (distinct.length > 0) {
          const allBounds = L.latLngBounds([] as never);
          distinct.forEach((z) => {
            try { allBounds.extend(L.geoJSON(JSON.parse(z.geojson) as never).getBounds()); } catch {}
          });
          if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [40, 40] });
        }
      });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
