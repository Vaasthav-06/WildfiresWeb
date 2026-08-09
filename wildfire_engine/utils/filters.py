from ..config import RISK_TIERS, RISK_COLOURS

CRITICAL_REGIONS = [
    {"name": "Kashmir & Ladakh", "lat_min": 32.0, "lat_max": 37.5, "lon_min": 73.0, "lon_max": 80.5},
    {"name": "Himachal Pradesh", "lat_min": 30.3, "lat_max": 33.3, "lon_min": 75.5, "lon_max": 79.0},
    {"name": "Uttarakhand", "lat_min": 28.7, "lat_max": 31.5, "lon_min": 77.5, "lon_max": 81.0},
    {"name": "Sikkim", "lat_min": 27.0, "lat_max": 28.5, "lon_min": 88.0, "lon_max": 89.5},
    {"name": "Arunachal Pradesh", "lat_min": 26.5, "lat_max": 29.5, "lon_min": 91.5, "lon_max": 97.5},
]


def apply_snowy_region_filter(lat: float, lon: float, temp: float, risk: float) -> float:
    if temp > 15.0:
        return risk

    for region in CRITICAL_REGIONS:
        if (
            region["lat_min"] <= lat <= region["lat_max"]
            and region["lon_min"] <= lon <= region["lon_max"]
        ):
            return 0.0

    return risk


def risk_to_tier(risk: float) -> str:
    for tier, (lo, hi) in RISK_TIERS.items():
        if lo <= risk < hi:
            return tier
    return "extreme"


def risk_to_color(risk: float) -> tuple[int, int, int, int]:
    r = risk / 100.0

    if r < 0.05:
        return (0, 180, 0, 100)
    elif r < 0.20:
        return (255, 220, 0, 100)
    elif r < 0.50:
        return (255, 140, 0, 120)
    elif r < 0.80:
        return (220, 0, 0, 140)
    else:
        return (140, 0, 200, 160)
