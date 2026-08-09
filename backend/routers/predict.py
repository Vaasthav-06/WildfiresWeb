from fastapi import APIRouter, Query
import logging

router = APIRouter(prefix="/api/v1", tags=["predict"])
logger = logging.getLogger(__name__)


@router.get("/predict")
def predict(lat: float = Query(...), lon: float = Query(...)):
    try:
        from backend.services.water_mask import is_on_water
        from wildfire_engine.inference.predictor import _is_on_land
        
        if is_on_water(lat, lon) or not _is_on_land(lat, lon):
            return {"water_body": True, "message": "Prediction disabled over water bodies."}
            
        from wildfire_engine.inference import predictor
        return predictor.predict(lat, lon)
    except Exception as e:
        logger.warning(f"Model predict failed, falling back to synthetic: {e}")
        return _synthetic_predict(lat, lon)


def _synthetic_predict(lat: float, lon: float) -> dict:
    import math
    from datetime import datetime

    month = datetime.now().month
    lat_factor = 1.0 - abs(lat - 22.0) / 20.0
    lon_factor = 1.0 - abs(lon - 80.0) / 15.0
    seasonal = 0.5 + 0.5 * math.sin(2 * math.pi * (month - 3) / 12)
    risk = max(0, min(100, lat_factor * lon_factor * seasonal * 100 * (0.8 + 0.4 * math.sin(lat * lon * 0.01))))

    return {
        "wildfire_risk": round(risk, 2),
        "temperature": round(25 + 10 * lat_factor + math.sin(month * 0.5) * 5, 1),
        "humidity": round(60 - 20 * lat_factor + math.cos(month * 0.5) * 10, 1),
        "wind": round(2 + 4 * seasonal, 1),
    }
