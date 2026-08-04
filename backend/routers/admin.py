import json
import logging
from fastapi import APIRouter, HTTPException, Depends, status
from backend.schemas.auth_schemas import ZoneCreate, ZoneOut
from backend.services.database import query, execute, execute_returning, is_available
from backend.middleware.auth_middleware import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _check_db():
    if not is_available():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not available")


@router.get("/zones", response_model=list[ZoneOut])
def list_zones(type: str = None, state: str = None, _: dict = Depends(require_admin)):
    conditions = []
    params = []
    if type:
        conditions.append("type = %s")
        params.append(type)
    if state:
        conditions.append("state = %s")
        params.append(state)

    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    rows = query(
        f"SELECT id, name, type, state, district, area_ha, metadata, created_at FROM zones{where} ORDER BY name",
        tuple(params) if params else None,
    )
    return [
        ZoneOut(
            id=r["id"], name=r["name"], type=r["type"],
            state=r.get("state"), district=r.get("district"),
            area_ha=r.get("area_ha"), metadata=r.get("metadata", {}),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]


@router.post("/zones", response_model=ZoneOut)
def create_zone(body: ZoneCreate, _: dict = Depends(require_admin)):
    row = execute_returning(
        """INSERT INTO zones (name, type, state, district, area_ha, metadata, geom)
           VALUES (%s, %s, %s, %s, %s, %s,
             CASE WHEN %s IS NOT NULL THEN ST_GeomFromGeoJSON(%s) ELSE NULL END)
           RETURNING id, name, type, state, district, area_ha, metadata, created_at""",
        (
            body.name, body.type, body.state, body.district, body.area_ha,
            json.dumps(body.metadata),
            json.dumps(body.geojson) if body.geojson else None,
            json.dumps(body.geojson) if body.geojson else None,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create zone")
    return ZoneOut(
        id=row["id"], name=row["name"], type=row["type"],
        state=row.get("state"), district=row.get("district"),
        area_ha=row.get("area_ha"), metadata=row.get("metadata", {}),
        created_at=row.get("created_at"),
    )


@router.get("/zones/{zone_id}", response_model=ZoneOut)
def get_zone(zone_id: int, _: dict = Depends(require_admin)):
    rows = query(
        "SELECT id, name, type, state, district, area_ha, metadata, created_at FROM zones WHERE id = %s",
        (zone_id,),
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    r = rows[0]
    return ZoneOut(
        id=r["id"], name=r["name"], type=r["type"],
        state=r.get("state"), district=r.get("district"),
        area_ha=r.get("area_ha"), metadata=r.get("metadata", {}),
        created_at=r.get("created_at"),
    )


@router.put("/zones/{zone_id}", response_model=ZoneOut)
def update_zone(zone_id: int, body: dict, _: dict = Depends(require_admin)):
    allowed = {"name", "type", "state", "district", "area_ha", "metadata"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields to update")

    set_parts = []
    params = []
    for k, v in updates.items():
        if k == "metadata":
            set_parts.append("metadata = %s")
            params.append(json.dumps(v))
        else:
            set_parts.append(f"{k} = %s")
            params.append(v)
    params.append(zone_id)

    execute(f"UPDATE zones SET {', '.join(set_parts)} WHERE id = %s", tuple(params))
    return get_zone(zone_id)


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: int, _: dict = Depends(require_admin)):
    rows = execute("DELETE FROM zones WHERE id = %s", (zone_id,))
    if rows == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")


@router.get("/zones/{zone_id}/geojson")
def get_zone_geojson(zone_id: int, _: dict = Depends(require_admin)):
    rows = query(
        "SELECT ST_AsGeoJSON(geom) as geojson FROM zones WHERE id = %s AND geom IS NOT NULL",
        (zone_id,),
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found or has no geometry")
    return json.loads(rows[0]["geojson"])


@router.get("/stats")
def system_stats(_: dict = Depends(require_admin)):
    zone_count = query("SELECT COUNT(*) as c FROM zones")[0]["c"]
    user_count = query("SELECT COUNT(*) as c FROM users")[0]["c"]
    alert_count = query("SELECT COUNT(*) as c FROM alerts_history")[0]["c"]
    return {
        "zones": zone_count,
        "users": user_count,
        "alerts": alert_count,
        "db_connected": True,
    }
