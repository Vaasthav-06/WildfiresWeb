import math
from datetime import datetime

FEATURE_COLS = [
    "latitude", "longitude",
    "temp", "humidity", "wind",
    "svp", "vpd",
    "month", "month_sin", "month_cos",
    "fire_danger_index", "moisture_stress", "drying_power", "seasonal_heat",
]


def _svp(temp_c: float) -> float:
    return 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))


def _vpd(temp_c: float, humidity_pct: float) -> float:
    return _svp(temp_c) * (1.0 - humidity_pct / 100.0)


def _fire_danger_index(temp_c: float, humidity_pct: float, wind_ms: float, vpd_kpa: float) -> float:
    t_factor = max(0.0, temp_c - 15.0) / 35.0
    h_factor = max(0.0, (100.0 - humidity_pct) / 100.0)
    w_factor = min(1.0, wind_ms / 15.0)
    v_factor = min(1.0, vpd_kpa / 5.0)
    fdi = (t_factor * 0.35 + h_factor * 0.30 + w_factor * 0.20 + v_factor * 0.15) * 100.0
    return round(fdi, 2)


def _moisture_stress(humidity_pct: float, vpd_kpa: float) -> float:
    return round(1.0 - humidity_pct / 100.0, 4)


def _drying_power(wind_ms: float, vpd_kpa: float) -> float:
    return round(wind_ms * vpd_kpa, 4)


def _seasonal_heat(temp_c: float, month: int) -> float:
    fire_season_weights = {1: 0.3, 2: 0.7, 3: 0.9, 4: 1.0, 5: 0.9, 6: 0.5,
                           7: 0.2, 8: 0.2, 9: 0.3, 10: 0.6, 11: 0.7, 12: 0.4}
    weight = fire_season_weights.get(month, 0.5)
    return round(temp_c * weight * 5.0, 2)


def build_features(lat: float, lon: float, temp: float, humidity: float, wind: float,
                   month: int = None) -> dict:
    if month is None:
        month = datetime.now().month

    svp_val = _svp(temp)
    vpd_val = _vpd(temp, humidity)

    return {
        "latitude": lat,
        "longitude": lon,
        "temp": temp,
        "humidity": humidity,
        "wind": wind,
        "svp": round(svp_val, 4),
        "vpd": round(vpd_val, 4),
        "month": month,
        "month_sin": round(math.sin(2 * math.pi * month / 12), 6),
        "month_cos": round(math.cos(2 * math.pi * month / 12), 6),
        "fire_danger_index": _fire_danger_index(temp, humidity, wind, vpd_val),
        "moisture_stress": _moisture_stress(humidity, vpd_val),
        "drying_power": _drying_power(wind, vpd_val),
        "seasonal_heat": _seasonal_heat(temp, month),
    }


def build_feature_array(lat: float, lon: float, temp: float, humidity: float, wind: float,
                        month: int = None) -> list:
    feats = build_features(lat, lon, temp, humidity, wind, month)
    return [feats[col] for col in FEATURE_COLS]
