from fastapi import APIRouter, Depends, HTTPException, status
from backend.services.database import query
from backend.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/v1/deforestation", tags=["deforestation"])


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

    monthly = query(
        """SELECT year, month, ROUND(ndvi::numeric, 4) as ndvi
           FROM vegetation_history
           WHERE zone_id = %s
           ORDER BY year, month""",
        (zone_id,),
    )

    zone_info = query("SELECT name, type, state FROM zones WHERE id = %s", (zone_id,))

    if not yearly:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No vegetation data for this zone")

    first = yearly[0]
    last = yearly[-1]
    ndvi_change = round(last["avg_ndvi"] - first["avg_ndvi"], 4)
    cover_change = round(last["avg_cover"] - first["avg_cover"], 1)

    return {
        "zone_id": zone_id,
        "zone_name": zone_info[0]["name"] if zone_info else "",
        "zone_type": zone_info[0]["type"] if zone_info else "",
        "state": zone_info[0]["state"] if zone_info else "",
        "yearly": yearly,
        "monthly": monthly,
        "summary": {
            "first_year": first["year"],
            "last_year": last["year"],
            "first_ndvi": first["avg_ndvi"],
            "last_ndvi": last["avg_ndvi"],
            "ndvi_change": ndvi_change,
            "cover_change_pct": cover_change,
            "trend": "declining" if ndvi_change < -0.02 else "stable" if abs(ndvi_change) < 0.02 else "improving",
        },
    }
