import requests
from typing import Optional
from ..config import config


class OpenMeteoClient:
    def __init__(self):
        self.base_url = config.open_meteo_base_url
        self.timeout = 10

    def fetch_current(self, lat: float, lon: float) -> dict:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        }
        try:
            r = requests.get(self.base_url, params=params, timeout=self.timeout)
            r.raise_for_status()
            data = r.json()
            current = data.get("current", {})
            return {
                "temperature": current.get("temperature_2m", 30),
                "humidity": current.get("relative_humidity_2m", 40),
                "wind": current.get("wind_speed_10m", 5),
            }
        except Exception:
            return {"temperature": 30, "humidity": 40, "wind": 5}

    def fetch_batch(self, points: list[tuple[float, float]]) -> list[dict]:
        if not points:
            return []

        lats = ",".join(str(p[0]) for p in points)
        lons = ",".join(str(p[1]) for p in points)

        params = {
            "latitude": lats,
            "longitude": lons,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        }
        try:
            r = requests.get(self.base_url, params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception:
            return [{"temperature": 30, "humidity": 40, "wind": 5} for _ in points]

        locations = data if isinstance(data, list) else [data]
        results = []

        for i, loc in enumerate(locations):
            current = loc.get("current", {})
            results.append({
                "temperature": current.get("temperature_2m", 30),
                "humidity": current.get("relative_humidity_2m", 40),
                "wind": current.get("wind_speed_10m", 5),
            })

        return results


weather_client = OpenMeteoClient()
