import math
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["region-analysis"])

REGION_CENTERS = {
    "corbett": (29.39, 79.28),
    "similipal": (22.23, 86.41),
    "jyotikuchi": (26.17, 91.77),
    "laisong": (25.85, 92.95),
}

REGION_META = {
    "corbett": {"name": "Corbett National Park", "state": "Uttarakhand", "area_sq_km": 1318},
    "similipal": {"name": "Similipal National Park", "state": "Odisha", "area_sq_km": 2750},
    "jyotikuchi": {"name": "Jyotikuchi Dhopolia Hill", "state": "Assam", "area_sq_km": 85},
    "laisong": {"name": "Laisong Reserved Forest", "state": "Assam", "area_sq_km": 450},
}


def _derive_feature_importance(features: dict) -> list[dict]:
    fdi = features.get("fire_danger_index", 0)
    moisture = features.get("moisture_stress", 0)
    drying = features.get("drying_power", 0)
    heat = features.get("seasonal_heat", 0)
    temp = features.get("temp", 0)
    humidity = features.get("humidity", 0)
    wind = features.get("wind", 0)
    vpd = features.get("vpd", 0)

    items = []
    if vpd > 1.5:
        items.append({"feature": "VPD", "direction": "up", "impact": "high", "explanation": "High vapour pressure deficit dries fuels rapidly"})
    elif vpd > 0.8:
        items.append({"feature": "VPD", "direction": "up", "impact": "moderate", "explanation": "Elevated VPD increases fuel drying"})
    else:
        items.append({"feature": "VPD", "direction": "neutral", "impact": "low", "explanation": "Low VPD keeps fuels moist"})

    if temp > 32:
        items.append({"feature": "Temperature", "direction": "up", "impact": "high", "explanation": "High temperatures accelerate moisture loss"})
    elif temp > 25:
        items.append({"feature": "Temperature", "direction": "up", "impact": "moderate", "explanation": "Warm conditions support fire spread"})
    else:
        items.append({"feature": "Temperature", "direction": "neutral", "impact": "low", "explanation": "Moderate temperatures limit fire activity"})

    if humidity < 30:
        items.append({"feature": "Humidity", "direction": "down", "impact": "high", "explanation": "Very low humidity creates extreme fire conditions"})
    elif humidity < 50:
        items.append({"feature": "Humidity", "direction": "down", "impact": "moderate", "explanation": "Low humidity contributes to fuel dryness"})
    else:
        items.append({"feature": "Humidity", "direction": "neutral", "impact": "low", "explanation": "Adequate humidity suppresses fire risk"})

    if wind > 8:
        items.append({"feature": "Wind", "direction": "up", "impact": "high", "explanation": "Strong winds drive rapid fire spread"})
    elif wind > 4:
        items.append({"feature": "Wind", "direction": "up", "impact": "moderate", "explanation": "Moderate winds can increase fire intensity"})
    else:
        items.append({"feature": "Wind", "direction": "neutral", "impact": "low", "explanation": "Light winds limit fire spread"})

    if moisture > 0.7:
        items.append({"feature": "Moisture Stress", "direction": "up", "impact": "high", "explanation": "High moisture stress indicates critically dry fuels"})
    elif moisture > 0.4:
        items.append({"feature": "Moisture Stress", "direction": "up", "impact": "moderate", "explanation": "Elevated moisture stress increases fire danger"})

    if drying > 20:
        items.append({"feature": "Drying Power", "direction": "up", "impact": "high", "explanation": "Strong evaporative demand dries out vegetation"})

    items.sort(key=lambda x: {"high": 3, "moderate": 2, "low": 1}.get(x["impact"], 0), reverse=True)
    return items[:6]


def _generate_explanation(risk_pct: float, features: dict) -> str:
    temp = features.get("temp", 0)
    humidity = features.get("humidity", 0)
    wind = features.get("wind", 0)
    vpd = features.get("vpd", 0)

    if risk_pct < 20:
        level = "low"
        reason = f"Favourable conditions — temperature at {temp:.0f}°C, humidity {humidity:.0f}%, and VPD at {vpd:.2f} kPa indicate limited fire potential. Standard monitoring is sufficient."
    elif risk_pct < 40:
        level = "moderate"
        reason = f"Conditions are becoming conducive to fire. Temperature ({temp:.0f}°C) and VPD ({vpd:.2f} kPa) suggest increasing fuel dryness. Review fire prevention plans."
    elif risk_pct < 65:
        level = "high"
        reason = f"Elevated fire risk. High temperature ({temp:.0f}°C), low humidity ({humidity:.0f}%), and wind ({wind:.1f} m/s) create a triple-threat scenario. Firebreaks should be maintained and patrols increased."
    elif risk_pct < 85:
        level = "very high"
        reason = f"Critical fire weather. With temperature at {temp:.0f}°C, humidity dropping to {humidity:.0f}%, and VPD at {vpd:.2f} kPa, fuels are primed for ignition. Prepare evacuation plans and deploy response teams."
    else:
        level = "extreme"
        reason = f"Extreme fire danger. Temperature ({temp:.0f}°C), critically low humidity ({humidity:.0f}%), and strong winds ({wind:.1f} m/s) indicate catastrophic fire potential. Immediate action required."

    return reason


@router.get("/region-analysis/{region}")
def region_analysis(region: str):
    if region not in REGION_CENTERS:
        raise HTTPException(status_code=404, detail=f"Unknown region: {region}")

    lat, lon = REGION_CENTERS[region]

    # Use a fallback flag in case real inference fails
    fallback_used = False
    temp, humidity, wind_val = 32.0, 40.0, 5.0
    risk = 45.0
    features = {}

    try:
        from wildfire_engine.inference import predictor
        from wildfire_engine.inference.feature_engineering import build_features
        from wildfire_engine.weather.client import weather_client
    except Exception as e:
        logger.error(f"Import failed: {e}")
        fallback_used = True

    if not fallback_used:
        try:
            weather = weather_client.fetch_current(lat, lon)
            temp = weather["temperature"]
            humidity = weather["humidity"]
            wind_val = weather["wind"]
            month = datetime.now().month

            features = build_features(lat, lon, temp, humidity, wind_val, month)
            result = predictor.predict(lat, lon)
            risk = result["wildfire_risk"]
            logger.info(f"Successfully ran prediction for {region} (Risk: {risk})")
        except Exception as e:
            logger.warning(f"Prediction/Weather failed for {region}, using fallback. Error: {e}")
            fallback_used = True

    if fallback_used:
        # Fallback dummy features if weather/model is unavailable
        logger.info(f"Using fallback mock data for {region}")
        features = {
            "temp": temp, "humidity": humidity, "wind": wind_val,
            "vpd": 1.2, "svp": 2.5, "fire_danger_index": 35.0,
            "moisture_stress": 0.5, "drying_power": 15.0, "seasonal_heat": 0.8
        }
        # Simulate risk based on some basic logic
        if region == "corbett": risk = 55.0
        elif region == "similipal": risk = 75.0
        elif region == "jyotikuchi": risk = 35.0
        elif region == "laisong": risk = 25.0

    if risk < 20:
        label = "Low"
    elif risk < 40:
        label = "Moderate"
    elif risk < 65:
        label = "High"
    elif risk < 85:
        label = "Very High"
    else:
        label = "Extreme"

    confidence = round(min(1.0, abs(risk / 100 - 0.5) * 2), 2)
    # Ensure confidence is somewhat realistic for fallbacks
    if fallback_used:
        confidence = 0.55

    return {
        "region": region,
        "region_name": REGION_META[region]["name"],
        "state": REGION_META[region]["state"],
        "area_sq_km": REGION_META[region]["area_sq_km"],
        "coordinates": {"lat": lat, "lon": lon},
        "risk": {
            "label": label,
            "probability": round(risk, 2),
            "confidence": confidence,
        },
        "model": {
            "name": "Ensemble (XGBoost + CatBoost)" if not fallback_used else "Fallback Mock Model",
            "type": "VotingClassifier" if not fallback_used else "Mock",
            "features": list(features.keys()),
            "feature_count": len(features),
        },
        "weather": {
            "temperature": temp,
            "humidity": humidity,
            "wind": wind_val,
            "vpd": features.get("vpd", 1.2),
            "svp": features.get("svp", 2.5),
        },
        "feature_importance": _derive_feature_importance(features),
        "explanation": _generate_explanation(risk, features),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
