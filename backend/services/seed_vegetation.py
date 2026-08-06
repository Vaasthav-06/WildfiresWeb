"""
Seed vegetation_history table with realistic 15-year NDVI data for ALL zones.
Models gradual deforestation patterns with seasonal variation based on zone type and region.
"""

import sys, os, math, random, logging
sys.path.insert(0, r'C:\Users\Lenovo\Desktop\wildfire_engine')
os.environ.setdefault("DATABASE_URL",
    "postgresql://neondb_owner:npg_64eAJCEwPDcO@ep-cool-sound-az67xr3o-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")

from backend.services.database import get_pool, execute, query

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

BASE_PROFILES = {
    "Corbett National Park": {"base_ndvi": 0.72, "decline": 0.004, "amp": 0.08, "disturb": 0.6, "cover": 78},
    "Similipal National Park": {"base_ndvi": 0.68, "decline": 0.007, "amp": 0.12, "disturb": 1.2, "cover": 72},
    "Jyotikuchi Dhopolia Hill": {"base_ndvi": 0.58, "decline": 0.012, "amp": 0.10, "disturb": 2.5, "cover": 52},
    "Laisong Reserved Forest": {"base_ndvi": 0.65, "decline": 0.006, "amp": 0.09, "disturb": 1.0, "cover": 65},
}

TYPE_MODIFIERS = {
    "reserve": {"ndvi_mul": 1.00, "decline_mul": 1.0, "cover_mul": 1.00},
    "buffer_zone": {"ndvi_mul": 0.85, "decline_mul": 1.8, "cover_mul": 0.85},
    "core_forest": {"ndvi_mul": 1.10, "decline_mul": 0.5, "cover_mul": 1.05},
    "eco_sensitive": {"ndvi_mul": 0.90, "decline_mul": 0.8, "cover_mul": 0.90},
    "beat_boundary": {"ndvi_mul": 0.92, "decline_mul": 1.3, "cover_mul": 0.88},
    "compartment": {"ndvi_mul": 0.95, "decline_mul": 1.4, "cover_mul": 0.92},
}


def _find_profile(zone_name, zone_type):
    for key, profile in BASE_PROFILES.items():
        if key in zone_name or zone_name in key:
            return profile
    if "Corbett" in zone_name: return BASE_PROFILES["Corbett National Park"]
    if "Similipal" in zone_name: return BASE_PROFILES["Similipal National Park"]
    if "Jyotikuchi" in zone_name or "Dhopolia" in zone_name: return BASE_PROFILES["Jyotikuchi Dhopolia Hill"]
    if "Laisong" in zone_name: return BASE_PROFILES["Laisong Reserved Forest"]
    return {"base_ndvi": 0.62, "decline": 0.006, "amp": 0.10, "disturb": 1.0, "cover": 60}


def seed():
    zones = query("SELECT id, name, type FROM zones ORDER BY type, name")
    existing = query("SELECT COUNT(*) as c FROM vegetation_history")

    if existing and existing[0]["c"] > 0:
        logger.info(f"Clearing {existing[0]['c']} existing vegetation records...")
        execute("DELETE FROM vegetation_history")

    count = 0
    for zone in zones:
        profile = _find_profile(zone["name"], zone["type"])
        mod = TYPE_MODIFIERS.get(zone["type"], TYPE_MODIFIERS["compartment"])

        for year in range(2005, 2026):
            elapsed = year - 2005
            base = profile["base_ndvi"] * mod["ndvi_mul"]
            decline = profile["decline"] * mod["decline_mul"] * elapsed
            seasonal_peak = profile["amp"]

            ndvi_dry = base - decline - seasonal_peak + random.gauss(0, 0.02)
            ndvi_dry = max(0.10, min(0.88, ndvi_dry))
            ndvi_wet = base - decline + seasonal_peak + random.gauss(0, 0.02)
            ndvi_wet = max(0.15, min(0.90, ndvi_wet))
            ndvi_annual = round((ndvi_dry * 0.4 + ndvi_wet * 0.6), 4)

            cover = profile["cover"] * mod["cover_mul"] - profile["disturb"] * mod["decline_mul"] * elapsed
            cover += random.gauss(0, 0.5)
            cover = max(8, min(92, cover))

            disturb = profile["disturb"] * mod["decline_mul"] * elapsed + random.uniform(-0.3, 0.3)
            disturb = max(0, min(35, disturb))

            execute(
                """INSERT INTO vegetation_history (zone_id, year, month, ndvi, vegetation_cover_pct, disturbance_pct)
                   VALUES (%s, %s, 6, %s, %s, %s) ON CONFLICT (zone_id, year, month) DO UPDATE
                   SET ndvi = EXCLUDED.ndvi, vegetation_cover_pct = EXCLUDED.vegetation_cover_pct,
                       disturbance_pct = EXCLUDED.disturbance_pct""",
                (zone["id"], year, ndvi_annual, round(cover, 1), round(disturb, 1)),
            )
            count += 1

    logger.info(f"Seeded {count} vegetation records across {len(zones)} zones")


if __name__ == "__main__":
    seed()
