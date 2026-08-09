from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


FEATURE_COLS_DEFAULT = [
    "month_sin", "month_cos",
    "temp", "humidity", "wind", "vpd",
    "evi",
    "vpd_wind",
    "elevation_m",
    "lc_tree_cover", "lc_shrubland", "lc_grassland", "lc_cropland",
    "lc_built_up", "lc_sparse_veg", "lc_snow_ice", "lc_water",
    "lc_herbaceous_wetland", "lc_mangroves", "lc_moss_lichen",
]

TARGET_COL = "fire_detected"

INDIA_BOUNDS = {
    "lat_min": 8.0, "lat_max": 37.6,
    "lon_min": 68.1, "lon_max": 97.4,
}

RISK_TIERS = {
    "low": (0.00, 0.20),
    "moderate": (0.20, 0.40),
    "high": (0.40, 0.65),
    "extreme": (0.65, 1.01),
}

RISK_COLOURS = {
    "low": "#2ecc71",
    "moderate": "#f1c40f",
    "high": "#e67e22",
    "extreme": "#c0392b",
}


@dataclass
class WildfireEngineConfig:
    models_dir: Path = field(default_factory=lambda: Path("models"))
    data_raw_dir: Path = field(default_factory=lambda: Path("data/raw"))
    data_processed_dir: Path = field(default_factory=lambda: Path("data/processed"))
    data_cache_dir: Path = field(default_factory=lambda: Path("data/cache"))
    outputs_dir: Path = field(default_factory=lambda: Path("outputs"))

    grid_resolution: float = 0.1
    risk_threshold_high: float = 0.50
    risk_threshold_critical: float = 0.80

    feature_cols: list = field(default_factory=lambda: FEATURE_COLS_DEFAULT)
    target_col: str = TARGET_COL
    india_bounds: dict = field(default_factory=lambda: INDIA_BOUNDS)

    random_seed: int = 42
    test_size: float = 0.2
    cv_folds: int = 5
    cv_sample_size: int = 200_000
    shap_sample: int = 5_000

    nasa_firms_api_key: str = ""
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_archive_url: str = "https://archive-api.open-meteo.com/v1/archive"

    cache_ttl_minutes: int = 60
    analytics_cache_ttl_minutes: int = 720

    database_url: str = ""
    jwt_secret: str = ""

    @property
    def db_url(self) -> str:
        import os
        return self.database_url or os.environ.get("DATABASE_URL", "")

    evi_fallback: float = 0.35
    spread_risk_threshold: float = 0.40

    def ensure_dirs(self):
        for d in [self.data_raw_dir, self.data_processed_dir, self.data_cache_dir,
                  self.models_dir, self.outputs_dir]:
            d.mkdir(parents=True, exist_ok=True)

    @property
    def eval_dir(self) -> Path:
        return self.outputs_dir / "model_evaluation"

    @property
    def shap_dir(self) -> Path:
        return self.outputs_dir / "shap_analysis"

    @property
    def default_model_path(self) -> Path:
        return self.models_dir / "wildfire_ensemble.pkl"


config = WildfireEngineConfig()
