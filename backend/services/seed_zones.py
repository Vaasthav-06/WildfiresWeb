"""
Seed the zones table with the 4 CNN-monitored regions and their compartment hierarchy.
Creates: reserve → buffer_zone → beat_boundary → compartment for each region.
"""

import sys, os, json, logging
sys.path.insert(0, r'C:\Users\Lenovo\Desktop\wildfire_engine')
os.environ.setdefault("DATABASE_URL",
    "postgresql://neondb_owner:npg_64eAJCEwPDcO@ep-cool-sound-az67xr3o-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")

from backend.services.database import get_pool, execute, query, execute_returning

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def make_rect_geojson(lat_min, lat_max, lon_min, lon_max):
    """Create a GeoJSON polygon from bounding box."""
    return {
        "type": "Polygon",
        "coordinates": [[
            [lon_min, lat_min],
            [lon_max, lat_min],
            [lon_max, lat_max],
            [lon_min, lat_max],
            [lon_min, lat_min],
        ]],
    }


def create_zone(name, ztype, state, district, area_ha, lat_min, lat_max, lon_min, lon_max, metadata=None):
    geojson = make_rect_geojson(lat_min, lat_max, lon_min, lon_max)
    row = execute_returning(
        """INSERT INTO zones (name, type, state, district, area_ha, metadata, geom)
           VALUES (%s, %s, %s, %s, %s, %s, ST_GeomFromGeoJSON(%s))
           RETURNING id, name, type""",
        (name, ztype, state, district, area_ha, json.dumps(metadata or {}), json.dumps(geojson)),
    )
    return row


def link_zones(parent_id, child_id):
    execute(
        "INSERT INTO zone_hierarchy (parent_zone_id, child_zone_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (parent_id, child_id),
    )


REGIONS = [
    {
        "id": "corbett",
        "name": "Corbett National Park",
        "state": "Uttarakhand",
        "district": "Nainital",
        "area_ha": 131800,
        "lat_min": 29.25, "lat_max": 29.55,
        "lon_min": 79.05, "lon_max": 79.50,
        "elevation": "300-2400m",
        "forest_type": "Himalayan Subtropical & Temperate",
        "fire_season": "February-May",
        "beats": [
            {"name": "Dhikala Beat", "compartments": ["Dhikala Grassland", "Sambar Road", "Ramganga Valley"]},
            {"name": "Bijrani Beat", "compartments": ["Bijrani Range", "Maidavan", "Garjia"]},
            {"name": "Jhirna Beat", "compartments": ["Jhirna Top", "Laldhang", "Kalagarh"]},
        ],
    },
    {
        "id": "similipal",
        "name": "Similipal National Park",
        "state": "Odisha",
        "district": "Mayurbhanj",
        "area_ha": 275000,
        "lat_min": 22.00, "lat_max": 22.45,
        "lon_min": 86.10, "lon_max": 86.70,
        "elevation": "250-1150m",
        "forest_type": "Tropical Dry Deciduous",
        "fire_season": "January-May",
        "beats": [
            {"name": "Barehipani Beat", "compartments": ["Barehipani Falls", "Joranda", "Gurguria"]},
            {"name": "Chahala Beat", "compartments": ["Chahala Range", "Nawana", "Jenabil"]},
            {"name": "Pithabata Beat", "compartments": ["Pithabata Gate", "Kuchei", "Balinala"]},
        ],
    },
    {
        "id": "jyotikuchi",
        "name": "Jyotikuchi Dhopolia Hill",
        "state": "Assam",
        "district": "Kamrup",
        "area_ha": 8500,
        "lat_min": 26.05, "lat_max": 26.28,
        "lon_min": 91.65, "lon_max": 91.88,
        "elevation": "100-600m",
        "forest_type": "Sub-Tropical Deciduous (Urban-Forest Interface)",
        "fire_season": "September-April",
        "beats": [
            {"name": "Dhopolia Beat", "compartments": ["Upper Hill", "Lower Valley", "Eastern Slope"]},
            {"name": "Jyotikuchi Beat", "compartments": ["North Ridge", "South Basin", "Central Grove"]},
        ],
    },
    {
        "id": "laisong",
        "name": "Laisong Reserved Forest",
        "state": "Assam",
        "district": "Dima Hasao",
        "area_ha": 45000,
        "lat_min": 25.70, "lat_max": 26.00,
        "lon_min": 92.80, "lon_max": 93.10,
        "elevation": "1200-1800m",
        "forest_type": "Tropical Deciduous Mixed Forest",
        "fire_season": "November-April",
        "beats": [
            {"name": "Upper Laisong Beat", "compartments": ["Ridge Top", "Pine Grove", "Eastern Hill"]},
            {"name": "Lower Laisong Beat", "compartments": ["Valley Floor", "River Bend", "Western Slope"]},
        ],
    },
]


def seed():
    existing = query("SELECT COUNT(*) as c FROM zones")
    if existing and existing[0]["c"] > 0:
        logger.info(f"Zones already exist ({existing[0]['c']} rows). Skipping seed.")
        return

    for region in REGIONS:
        pad = 0.02
        rid = region["id"]

        # Create reserve
        res = create_zone(
            region["name"], "reserve", region["state"], region["district"],
            region["area_ha"],
            region["lat_min"], region["lat_max"], region["lon_min"], region["lon_max"],
            {"forest_type": region["forest_type"], "fire_season": region["fire_season"], "elevation": region["elevation"]},
        )
        logger.info(f"  Reserve: {res['name']} (id={res['id']})")

        # Create buffer zone (slightly larger)
        buf = create_zone(
            f"{region['name']} Buffer Zone", "buffer_zone", region["state"], region["district"],
            region["area_ha"] * 0.3,
            region["lat_min"] - pad, region["lat_max"] + pad,
            region["lon_min"] - pad, region["lon_max"] + pad,
            {"parent_reserve": rid},
        )
        link_zones(res["id"], buf["id"])

        # Create core zone
        core = create_zone(
            f"{region['name']} Core Forest", "core_forest", region["state"], region["district"],
            region["area_ha"] * 0.5,
            region["lat_min"] + pad, region["lat_max"] - pad,
            region["lon_min"] + pad, region["lon_max"] - pad,
            {"parent_reserve": rid},
        )
        link_zones(res["id"], core["id"])

        # Create eco-sensitive zone
        esa = create_zone(
            f"{region['name']} Eco-Sensitive Area", "eco_sensitive", region["state"], region["district"],
            region["area_ha"] * 0.6,
            region["lat_min"] - pad * 2, region["lat_max"] + pad * 2,
            region["lon_min"] - pad * 2, region["lon_max"] + pad * 2,
            {"parent_reserve": rid, "notification": "MoEFCC ESA Notification"},
        )
        link_zones(res["id"], esa["id"])

        # Create beats and compartments
        for beat in region["beats"]:
            b_lat_min = region["lat_min"] + pad + (hash(beat["name"]) % 100) / 1000.0
            b_lon_min = region["lon_min"] + pad + (hash(beat["name"]) % 100) / 2000.0
            b = create_zone(
                beat["name"], "beat_boundary", region["state"], region["district"],
                region["area_ha"] / len(region["beats"]),
                b_lat_min, b_lat_min + 0.08, b_lon_min, b_lon_min + 0.12,
                {"parent_reserve": rid},
            )
            link_zones(core["id"], b["id"])

            for comp in beat["compartments"]:
                c_lat_min = b_lat_min + 0.01
                c_lon_min = b_lon_min + 0.02
                c = create_zone(
                    comp, "compartment", region["state"], region["district"],
                    (region["area_ha"] / len(region["beats"])) / len(beat["compartments"]),
                    c_lat_min, c_lat_min + 0.04, c_lon_min, c_lon_min + 0.06,
                    {"parent_reserve": rid, "beat": beat["name"]},
                )
                link_zones(b["id"], c["id"])

    logger.info(f"Seeded {query('SELECT COUNT(*) as c FROM zones')[0]['c']} zones")


if __name__ == "__main__":
    seed()
