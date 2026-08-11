import re

def fix_prediction_modal():
    with open('frontend/src/components/overlays/PredictionModal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    c1_replace = '''  const closeModal = () => {
    useAppStore.setState({ predictionMode: false, selectedPoint: null });
  };

  const result = useMemo(() => {
    if (!selectedPoint || !heatmap?.points?.length) return null;
    const r = findNearest(selectedPoint.lat, selectedPoint.lon, heatmap.points);
    const isSea = r.distDeg > 1.0;
    return { ...r, isSea };
  }, [selectedPoint, heatmap]);

  const nearest = result?.point;
  const isSea = result?.isSea ?? false;
  const risk = nearest?.risk ?? 0;
  const tier = riskTier(risk);'''
    
    c2_replace = '''            ) : weather?.water_body ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="rounded-full bg-blue-100 p-3">
                  <Droplets className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">Water Body Detected</h3>
                  <p className="mt-1 text-[12px] text-slate-500">Fire predictions are disabled for coordinates located over water.</p>
                </div>
              </div>
            ) : isSea ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="font-mono text-slate-700">
                    {selectedPoint!.lat.toFixed(4)}, {selectedPoint!.lon.toFixed(4)}
                  </span>
'''

    pattern = re.compile(r'<<<<<<< HEAD\n.*?>>>>>>> srajang/main\n?', re.DOTALL)
    matches = pattern.findall(content)
    
    if len(matches) == 2:
        content = content.replace(matches[0], c1_replace + '\n')
        content = content.replace(matches[1], c2_replace)
    
    with open('frontend/src/components/overlays/PredictionModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

def fix_region_map():
    with open('frontend/src/components/region-analysis/RegionMap.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Conflict 1
    # <<<<<<< HEAD
    # import { useAppStore } from "@/stores/appStore";
    # =======
    # >>>>>>> srajang/main
    c1_replace = 'import { useAppStore } from "@/stores/appStore";'
    
    # Conflict 2
    # <<<<<<< HEAD
    # =======
    #   const rectRef = useRef<L.Rectangle | null>(null);
    #   const markerRef = useRef<L.CircleMarker | null>(null);
    # >>>>>>> srajang/main
    c2_replace = '''  const rectRef = useRef<L.Rectangle | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);'''

    # Conflict 3
    # <<<<<<< HEAD
    #     L.tileLayer(
    #       "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    #       { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
    #     ).addTo(map);
    # =======
    #     L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    #       attribution: "Esri, Maxar", maxZoom: 19,
    #     }).addTo(map);
    # >>>>>>> srajang/main
    c3_replace = '''    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
    ).addTo(map);'''

    # Conflict 4
    # <<<<<<< HEAD
    #     return () => {
    #       unsubscribe();
    #       map.remove();
    #       mapRef.current = null;
    #       initialized.current = false;
    #     };
    #     // eslint-disable-next-line react-hooks/exhaustive-deps
    # =======
    #     return () => { map.remove(); mapRef.current = null; initialized.current = false; };
    # >>>>>>> srajang/main
    c4_replace = '''    return () => {
      unsubscribe();
      map.remove();
      mapRef.current = null;
      initialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps'''

    # Conflict 5
    # <<<<<<< HEAD
    # 
    #     if (boundaryLayer.current) {
    #       mapRef.current.removeLayer(boundaryLayer.current);
    #       boundaryLayer.current = null;
    #     }
    # 
    #     console.log(`[RegionMap] Loading boundary for region: ${regionId}`);
    # 
    #     fetch("/forestReserves.geojson")
    #       .then((r) => r.json())
    #       .then((data) => {
    #         const filtered = (data.features as any[]).filter(
    #           (f: any) => f?.properties?.id === regionId
    #         );
    #         console.log(`[RegionMap] GeoJSON features found for "${regionId}": ${filtered.length}`);
    # 
    #         if (filtered.length === 0) {
    #           setNoFeatureWarning(true);
    #         } else {
    #           setNoFeatureWarning(false);
    #         }
    # 
    # =======
    #     fetch("/forestReserves.geojson")
    #       .then((r) => r.json())
    #       .then((data) => {
    # >>>>>>> srajang/main
    c5_replace = '''
    if (boundaryLayer.current) {
      mapRef.current.removeLayer(boundaryLayer.current);
      boundaryLayer.current = null;
    }

    console.log(`[RegionMap] Loading boundary for region: ${regionId}`);

    fetch("/forestReserves.geojson")
      .then((r) => r.json())
      .then((data) => {
        const filtered = (data.features as any[]).filter(
          (f: any) => f?.properties?.id === regionId
        );
        console.log(`[RegionMap] GeoJSON features found for "${regionId}": ${filtered.length}`);

        if (filtered.length === 0) {
          setNoFeatureWarning(true);
        } else {
          setNoFeatureWarning(false);
        }
'''

    pattern = re.compile(r'<<<<<<< HEAD\n.*?>>>>>>> srajang/main\n?', re.DOTALL)
    matches = pattern.findall(content)
    
    if len(matches) == 5:
        content = content.replace(matches[0], c1_replace + '\n')
        content = content.replace(matches[1], c2_replace + '\n')
        content = content.replace(matches[2], c3_replace + '\n')
        content = content.replace(matches[3], c4_replace + '\n')
        content = content.replace(matches[4], c5_replace + '\n')
    
    with open('frontend/src/components/region-analysis/RegionMap.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

fix_prediction_modal()
fix_region_map()
