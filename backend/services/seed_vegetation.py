"""
Seed vegetation_history table with realistic 15-year NDVI data for each reserve zone.
Models gradual deforestation patterns with seasonal variation.
"""

import sys, os, math, random, logging
sys.path.insert(0, r'C:\Users\Lenovo\Desktop\wildfire_engine')
os.environ.setdefault("DATABASE_URL",
    "postgresql://neondb_owner:npg_64eAJCEwPDcO@ep-cool-sound-az67xr3o-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")

from backend.services.database import get_pool, execute, query

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

REGION_PROFILES = {
    "Corbett National Park": {
        "base_ndvi": 0.72, "annual_decline": 0.004, "seasonal_amp": 0.08,
        "disturbance_rate": 0.6, "cover_pct": 78,
    },
    "Similipal National Park": {
        "base_ndvi": 0.68, "annual_decline": 0.007, "seasonal_amp": 0.12,
        "disturbance_rate": 1.2, "cover_pct": 72,
    },
    "Jyotikuchi Dhopolia Hill": {
        "base_ndvi": 0.58, "annual_decline": 0.012, "seasonal_amp": 0.10,
        "disturbance_rate": 2.5, "cover_pct": 52,
    },
    "Laisong Reserved Forest": {
        "base_ndvi": 0.65, "annual_decline": 0.006, "seasonal_amp": 0.09,
        "disturbance_rate": 1.0, "cover_pct": 65,
    },
}


def seed():
    zones = query("SELECT id, name FROM zones WHERE type = 'reserve'")
    existing = query("SELECT COUNT(*) as c FROM vegetation_history")

    if existing and existing[0]["c"] > 0:
        logger.info(f"Vegetation data exists ({existing[0]['c']} rows). Clearing and re-seeding...")
        execute("DELETE FROM vegetation_history")

    count = 0
    for zone in zones:
        profile = REGION_PROFILES.get(zone["name"])
        if not profile:
            continue

        for year in range(2005, 2026):
            years_elapsed = year - 2005
            for month in range(1, 13):
                base = profile["base_ndvi"]
                decline = profile["annual_decline"] * years_elapsed
                seasonal = profile["seasonal_amp"] * math.sin(2 * math.pi * (month - 3) / 12)

                ndvi = base - decline + seasonal
                ndvi += random.gauss(0, 0.02)
                ndvi = max(0.15, min(0.85, ndvi))

                cover = profile["cover_pct"] - profile["disturbance_rate"] * years_elapsed
                cover += random.gauss(0, 0.5)
                cover = max(10, min(90, cover))

                disturb = profile["disturbance_rate"] * years_elapsed
                disturb += random.uniform(-0.3, 0.3)
                disturb = max(0, min(30, disturb))

                execute(
                    """INSERT INTO vegetation_history (zone_id, year, month, ndvi, vegetation_cover_pct, disturbance_pct)
                       VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (zone_id, year, month) DO UPDATE
                       SET ndvi = EXCLUDED.ndvi, vegetation_cover_pct = EXCLUDED.vegetation_cover_pct,
                           disturbance_pct = EXCLUDED.disturbance_pct""",
                    (zone["id"], year, month, round(ndvi, 4), round(cover, 1), round(disturb, 1)),
                )
                count += 1

    logger.info(f"Seeded {count} vegetation records across {len(zones)} zones")


if __name__ == "__main__":
    seed()
