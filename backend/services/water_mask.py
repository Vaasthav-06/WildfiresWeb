import json
import logging
from pathlib import Path
from shapely.geometry import shape, Point
from functools import lru_cache

logger = logging.getLogger(__name__)

# Cache the water geometries to avoid loading them on every request
@lru_cache(maxsize=1)
def _get_water_geometries():
    gis_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "gis"
    water_polygons = []
    
    if not gis_dir.exists():
        logger.warning(f"GIS directory not found: {gis_dir}")
        return water_polygons

    # Find all *_layers.geojson files
    for filepath in gis_dir.glob("*_layers.geojson"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                features = data.get("features", [])
                for feat in features:
                    props = feat.get("properties", {})
                    # Check if it's a water layer
                    if props.get("layer_type") == "water":
                        geom = feat.get("geometry", {})
                        if not geom:
                            continue
                        
                        try:
                            s = shape(geom)
                            # If it's a LineString (like a river), buffer it by ~500m (0.005 deg)
                            # If it's a Polygon, buffering by 0.005 is fine too to catch near-water edges
                            buffered_geom = s.buffer(0.005)
                            water_polygons.append(buffered_geom)
                        except Exception as e:
                            logger.error(f"Error parsing geometry in {filepath.name}: {e}")
        except Exception as e:
            logger.error(f"Failed to read {filepath.name}: {e}")
            
    return water_polygons

def is_on_water(lat: float, lon: float) -> bool:
    """
    Checks if a given lat, lon intersects with any known water body geometries.
    """
    try:
        pt = Point(lon, lat)
        geoms = _get_water_geometries()
        return any(g.contains(pt) for g in geoms)
    except Exception as e:
        logger.error(f"Error checking water intersection: {e}")
        return False
