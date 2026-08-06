"""Returns all zones with vegetation data + their trends for the interactive deforestation map."""

from fastapi import APIRouter, Depends, HTTPException, status
from backend.services.database import query
from backend.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/v1/deforestation", tags=["deforestation"])

TREND_COLORS = {"declining": "#DC2626", "stable": "#F59E0B", "improving": "#16A34A"}


@router.get("/map-data")
def get_map_data(user: dict = Depends(get_current_user)):
    rows = query(
        """SELECT z.id, z.name, z.type, z.state,
                  ST_AsGeoJSON(z.geom) as geojson,
                  v.ndvi_first, v.ndvi_last, v.ndvi_change, v.cover_change, v.trend
           FROM zones z
           JOIN (
             SELECT zone_id,
               (ARRAY_AGG(ndvi ORDER BY year))[1] as ndvi_first,
               (ARRAY_AGG(ndvi ORDER BY year DESC))[1] as ndvi_last,
               ROUND(((ARRAY_AGG(ndvi ORDER BY year DESC))[1] - (ARRAY_AGG(ndvi ORDER BY year))[1])::numeric, 4) as ndvi_change,
               ROUND(((ARRAY_AGG(vegetation_cover_pct ORDER BY year DESC))[1] - (ARRAY_AGG(vegetation_cover_pct ORDER BY year))[1])::numeric, 1) as cover_change,
               CASE
                 WHEN (ARRAY_AGG(ndvi ORDER BY year DESC))[1] - (ARRAY_AGG(ndvi ORDER BY year))[1] < -0.02 THEN 'declining'
                 WHEN (ARRAY_AGG(ndvi ORDER BY year DESC))[1] - (ARRAY_AGG(ndvi ORDER BY year))[1] BETWEEN -0.02 AND 0.02 THEN 'stable'
                 ELSE 'improving'
               END as trend
             FROM vegetation_history
             GROUP BY zone_id
           ) v ON z.id = v.zone_id
           WHERE z.geom IS NOT NULL
           ORDER BY v.ndvi_change ASC""",
    )
    return [
        {
            "id": r["id"], "name": r["name"], "type": r["type"],
            "state": r.get("state"), "geojson": r["geojson"],
            "ndvi_first": r["ndvi_first"], "ndvi_last": r["ndvi_last"],
            "ndvi_change": r["ndvi_change"], "cover_change": r["cover_change"],
            "trend": r["trend"], "color": TREND_COLORS.get(r["trend"], "#94A3B8"),
        }
        for r in rows
    ]


@router.get("/{zone_id}")
def get_zone_history(zone_id: int, user: dict = Depends(get_current_user)):
    yearly = query(
        """SELECT year, ROUND(AVG(ndvi)::numeric, 4) as avg_ndvi,
                  ROUND(AVG(vegetation_cover_pct)::numeric, 1) as avg_cover,
                  ROUND(AVG(disturbance_pct)::numeric, 1) as avg_disturbance
           FROM vegetation_history
           WHERE zone_id = %s
           GROUP BY year ORDER BY year""",
        (zone_id,),
    )
    zone_info = query("SELECT name, type, state FROM zones WHERE id = %s", (zone_id,))

    if not yearly:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No vegetation data")

    first = yearly[0]; last = yearly[-1]
    ndvi_change = round(last["avg_ndvi"] - first["avg_ndvi"], 4)
    cover_change = round(last["avg_cover"] - first["avg_cover"], 1)

    return {
        "zone_id": zone_id,
        "zone_name": zone_info[0]["name"] if zone_info else "",
        "zone_type": zone_info[0]["type"] if zone_info else "",
        "state": zone_info[0]["state"] if zone_info else "",
        "yearly": yearly,
        "summary": {
            "first_year": first["year"], "last_year": last["year"],
            "first_ndvi": first["avg_ndvi"], "last_ndvi": last["avg_ndvi"],
            "ndvi_change": ndvi_change, "cover_change_pct": cover_change,
            "trend": "declining" if ndvi_change < -0.02 else "stable" if abs(ndvi_change) < 0.02 else "improving",
        },
    }
