import time
import threading
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/api/v1", tags=["heatmap"])

_heatmap_cache: list[dict] = []
_cache_time: str = ""
_lock = threading.Lock()

MODEL_AVAILABLE = False

_INDIA_POLY = None
_GEOJSON_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "india.geojson"


def _load_india():
    global _INDIA_POLY
    if _INDIA_POLY is not None:
        return _INDIA_POLY
    if not _GEOJSON_PATH.exists():
        return None
    from shapely.geometry import shape, Point
    with open(_GEOJSON_PATH) as f:
        gj = json.load(f)
    polys = []
    for feat in gj.get("features", []):
        try:
            polys.append(shape(feat["geometry"]))
        except Exception:
            pass
    _INDIA_POLY = polys if polys else None
    return _INDIA_POLY


def _is_on_land(lat: float, lon: float) -> bool:
    polys = _load_india()
    if polys is None:
        return True
    from shapely.geometry import Point
    pt = Point(lon, lat)
    return any(p.contains(pt) or p.touches(pt) for p in polys)


def _filter_land_only(points: list[dict]) -> list[dict]:
    return [p for p in points if _is_on_land(p["lat"], p["lon"])]


def _generate_synthetic_heatmap(resolution: float = 0.5) -> list[dict]:
    import math

    points = []
    lat = 6.5
    month = datetime.now().month

    while lat <= 38.0:
        lon = 67.0
        while lon <= 98.0:
            if _is_on_land(lat, lon):
                lat_factor = 1.0 - abs(lat - 22.0) / 20.0
                lon_factor = 1.0 - abs(lon - 80.0) / 15.0
                seasonal = 0.5 + 0.5 * math.sin(2 * math.pi * (month - 3) / 12)
                risk = max(0, min(100, lat_factor * lon_factor * seasonal * 100 * (0.8 + 0.4 * math.sin(lat * lon * 0.01))))

                if risk > 1:
                    points.append({"lat": round(lat, 4), "lon": round(lon, 4), "risk": round(risk, 2)})
            lon += resolution
        lat += resolution

    return points


def _refresh_cache():
    global _heatmap_cache, _cache_time
    with _lock:
        points = None
        try:
            if MODEL_AVAILABLE:
                from wildfire_engine.inference import predictor
                points = predictor.predict_heatmap(resolution=0.5)
            if not points:
                points = _generate_synthetic_heatmap(resolution=0.5)
        except Exception as e:
            logger.warning(f"Model heatmap failed, using synthetic: {e}")
            points = _generate_synthetic_heatmap(resolution=0.5)

        points = _filter_land_only(points)
        _heatmap_cache = points
        _cache_time = datetime.now(timezone.utc).isoformat()
        logger.info(f"Heatmap updated: {len(points)} points")

        from backend.routers.tiles import invalidate_cache, generate_heatmap_image
        invalidate_cache()
        generate_heatmap_image(points)
        logger.info("Heatmap image pre-generated")


def _background_worker():
    _refresh_cache()
    while True:
        time.sleep(900)
        _refresh_cache()


_bg_thread = threading.Thread(target=_background_worker, daemon=True)


def start_heatmap_worker():
    if not _bg_thread.is_alive():
        _bg_thread.start()


@router.get("/heatmap")
def get_heatmap(resolution: float = Query(0.5, ge=0.1, le=2.0)):
    with _lock:
        points = _heatmap_cache
        cache_time = _cache_time

    if not points:
        points = _generate_synthetic_heatmap(resolution=resolution)
        points = _filter_land_only(points)
        cache_time = datetime.now(timezone.utc).isoformat()

    return JSONResponse(
        content={
            "points": _filter_land_only(points),
            "cached": bool(_heatmap_cache),
            "generated_at": cache_time,
        },
        headers={"Cache-Control": "public, max-age=300"},
    )
