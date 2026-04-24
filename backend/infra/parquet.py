"""Parquet ETL and history reader with per-bucket representative sampling."""
import os
from datetime import datetime, timezone, timedelta

import pandas as pd

from infra.sensor_repo import query_since
from infra.notifications import write as write_notification

_PARQUET_DATA_PATH: str | None = None
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
_BUCKET_COUNT = 200
_SCALE_WINDOWS: dict[str, timedelta] = {
    "minute": timedelta(minutes=1),
    "hour": timedelta(hours=1),
    "day": timedelta(hours=24),
    "week": timedelta(days=7),
}
_SENSORS = ["temperature", "noise_level", "humidity", "wind_speed"]


def _data_path() -> str:
    global _PARQUET_DATA_PATH
    if _PARQUET_DATA_PATH is None:
        _PARQUET_DATA_PATH = os.getenv("PARQUET_DATA_PATH", "./data/parquet")
    return _PARQUET_DATA_PATH


def _file_path(windmill_id: str) -> str:
    return os.path.join(_data_path(), f"{windmill_id}.parquet")


# ---------------------------------------------------------------------------
# ETL
# ---------------------------------------------------------------------------

def run_etl(windmill_id: str, db) -> dict:
    """
    Incremental ETL: transfer new sensor readings from PostgreSQL to Parquet.

    Returns {"windmill_id": ..., "rows_written": N}.
    Raises on any exception after writing an error notification.
    """
    try:
        path = _file_path(windmill_id)
        os.makedirs(_data_path(), exist_ok=True)

        # Determine cutoff timestamp
        if os.path.exists(path):
            existing_df = pd.read_parquet(path)
            if len(existing_df) > 0:
                ts_col = pd.to_datetime(existing_df["measurement_timestamp"], utc=True)
                cutoff = ts_col.max().to_pydatetime()
            else:
                cutoff = _EPOCH
        else:
            existing_df = None
            cutoff = _EPOCH

        # Query new rows
        rows = query_since(db, windmill_id, cutoff)

        if not rows:
            write_notification("info", f"ETL complete — 0 new rows for {windmill_id}", "windmill", windmill_id)
            return {"windmill_id": windmill_id, "rows_written": 0}

        new_df = pd.DataFrame([{
            "measurement_timestamp": r.measurement_timestamp,
            "temperature": r.temperature,
            "noise_level": r.noise_level,
            "humidity": r.humidity,
            "wind_speed": r.wind_speed,
        } for r in rows])

        if existing_df is not None and len(existing_df) > 0:
            combined = pd.concat([existing_df, new_df], ignore_index=True)
        else:
            combined = new_df

        combined.to_parquet(path, index=False, engine="pyarrow")

        n = len(rows)
        write_notification("info", f"ETL complete — {n} rows written for {windmill_id}", "windmill", windmill_id)
        return {"windmill_id": windmill_id, "rows_written": n}

    except Exception as exc:
        write_notification("error", f"ETL failed for {windmill_id}: {exc}", "windmill", windmill_id)
        raise


# ---------------------------------------------------------------------------
# History reader
# ---------------------------------------------------------------------------

def read_history(windmill_id: str, scale: str, windmill_config: dict) -> list[dict]:
    """
    Return historical sensor data for windmill_id at the requested scale.

    windmill_config must contain {sensor}_clamp_min and {sensor}_spike_max for all 4 sensors.
    Returns raw rows for 'minute'; up to 200 representative-sampled points for other scales.
    """
    path = _file_path(windmill_id)
    if not os.path.exists(path):
        return []

    df = pd.read_parquet(path)
    if len(df) == 0:
        return []

    df["measurement_timestamp"] = pd.to_datetime(df["measurement_timestamp"], utc=True)
    now = datetime.now(timezone.utc)
    window = _SCALE_WINDOWS[scale]
    cutoff = now - window

    df = df[df["measurement_timestamp"] >= pd.Timestamp(cutoff)]
    if len(df) == 0:
        return []

    df = df.sort_values("measurement_timestamp").reset_index(drop=True)

    # minute scale: return raw rows, no sampling
    if scale == "minute":
        return [
            {
                "measurement_timestamp": row["measurement_timestamp"].isoformat(),
                "temperature": float(row["temperature"]),
                "noise_level": float(row["noise_level"]),
                "humidity": float(row["humidity"]),
                "wind_speed": float(row["wind_speed"]),
            }
            for _, row in df.iterrows()
        ]

    # Compute sensor value ranges for normalised deviation scoring
    sensor_ranges: dict[str, float] = {
        "temperature": windmill_config["temp_spike_max"] - windmill_config["temp_clamp_min"],
        "noise_level": windmill_config["noise_spike_max"] - windmill_config["noise_clamp_min"],
        "humidity": windmill_config["humidity_spike_max"] - windmill_config["humidity_clamp_min"],
        "wind_speed": windmill_config["wind_spike_max"] - windmill_config["wind_clamp_min"],
    }

    bucket_duration = window / _BUCKET_COUNT
    result: list[dict] = []

    for i in range(_BUCKET_COUNT):
        bucket_start = pd.Timestamp(cutoff + i * bucket_duration)
        bucket_end = pd.Timestamp(cutoff + (i + 1) * bucket_duration)

        mask = (df["measurement_timestamp"] >= bucket_start) & (df["measurement_timestamp"] < bucket_end)
        bucket = df[mask]
        if len(bucket) == 0:
            continue

        means = {s: bucket[s].mean() for s in _SENSORS}

        def _score(row: pd.Series) -> float:
            total = 0.0
            for s in _SENSORS:
                r = sensor_ranges[s]
                if r > 0:
                    total += abs(row[s] - means[s]) / r
            return total

        bucket = bucket.copy()
        bucket["_score"] = bucket.apply(_score, axis=1)
        rep = bucket.loc[bucket["_score"].idxmax()]

        result.append({
            "measurement_timestamp": rep["measurement_timestamp"].isoformat(),
            "temperature": float(rep["temperature"]),
            "noise_level": float(rep["noise_level"]),
            "humidity": float(rep["humidity"]),
            "wind_speed": float(rep["wind_speed"]),
        })

    return result


# ---------------------------------------------------------------------------
# File manager
# ---------------------------------------------------------------------------

def list_files(windmill_ids_running: set[str]) -> list[dict]:
    """Return metadata for every .parquet file in the data directory."""
    data_path = _data_path()
    if not os.path.exists(data_path):
        return []
    result = []
    for fname in os.listdir(data_path):
        if not fname.endswith(".parquet"):
            continue
        path = os.path.join(data_path, fname)
        stat = os.stat(path)
        windmill_id = fname[:-8]  # strip ".parquet"
        result.append({
            "windmill_id": windmill_id,
            "size_bytes": stat.st_size,
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "in_use": windmill_id in windmill_ids_running,
        })
    return result


def delete_file(windmill_id: str) -> None:
    """Delete the Parquet file for windmill_id."""
    path = _file_path(windmill_id)
    if os.path.exists(path):
        os.remove(path)


def file_exists(windmill_id: str) -> bool:
    """Return True if a Parquet file exists for windmill_id."""
    return os.path.exists(_file_path(windmill_id))
