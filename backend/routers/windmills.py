"""Windmill management routes."""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from infra.db import get_db
from infra import farm_repo, windmill_repo, parquet
from infra.notifications import write as write_notification
from routers import simulation as sim, ws_registry

router = APIRouter()
_WINDMILL_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]+$")


class WindmillCreate(BaseModel):
    windmill_id: str = Field(..., max_length=32)
    farm_id: int
    name: str = Field(..., max_length=60)
    description: str = Field(..., max_length=100)
    sensor_beat: int = Field(5, ge=1)
    sensor_beat_unit: str = "ss"
    location_beat: int = Field(1, ge=1)
    location_beat_unit: str = "dd"
    lat: float = Field(0.0, ge=-90, le=90)
    lat_dir: str = "N"
    lon: float = Field(0.0, ge=-180, le=180)
    lon_dir: str = "E"
    temp_clamp_min: float = 0.0
    temp_normal_min: float = 20.0
    temp_normal_max: float = 50.0
    temp_spike_max: float = 200.0
    noise_clamp_min: float = 0.0
    noise_normal_min: float = 5.0
    noise_normal_max: float = 60.0
    noise_spike_max: float = 180.0
    humidity_clamp_min: float = 0.0
    humidity_normal_min: float = 10.0
    humidity_normal_max: float = 90.0
    humidity_spike_max: float = 99.0
    wind_clamp_min: float = 0.0
    wind_normal_min: float = 2.0
    wind_normal_max: float = 45.0
    wind_spike_max: float = 200.0
    temp_rate: float = 2.0
    noise_rate: float = 2.0
    humidity_rate: float = 2.0
    wind_rate: float = 2.0

    @field_validator("windmill_id")
    @classmethod
    def validate_windmill_id(cls, v: str) -> str:
        if not _WINDMILL_ID_RE.match(v):
            raise ValueError("windmill_id may only contain alphanumeric characters, underscores, and hyphens.")
        return v


class WindmillUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    description: Optional[str] = Field(None, max_length=100)
    sensor_beat: Optional[int] = Field(None, ge=1)
    sensor_beat_unit: Optional[str] = None
    location_beat: Optional[int] = Field(None, ge=1)
    location_beat_unit: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lat_dir: Optional[str] = None
    lon: Optional[float] = Field(None, ge=-180, le=180)
    lon_dir: Optional[str] = None
    temp_clamp_min: Optional[float] = None
    temp_normal_min: Optional[float] = None
    temp_normal_max: Optional[float] = None
    temp_spike_max: Optional[float] = None
    noise_clamp_min: Optional[float] = None
    noise_normal_min: Optional[float] = None
    noise_normal_max: Optional[float] = None
    noise_spike_max: Optional[float] = None
    humidity_clamp_min: Optional[float] = None
    humidity_normal_min: Optional[float] = None
    humidity_normal_max: Optional[float] = None
    humidity_spike_max: Optional[float] = None
    wind_clamp_min: Optional[float] = None
    wind_normal_min: Optional[float] = None
    wind_normal_max: Optional[float] = None
    wind_spike_max: Optional[float] = None
    temp_rate: Optional[float] = None
    noise_rate: Optional[float] = None
    humidity_rate: Optional[float] = None
    wind_rate: Optional[float] = None


@router.get("/farms/{farm_id}/windmills", summary="List windmills in a farm")
def list_windmills(farm_id: int, db: Session = Depends(get_db)):
    """Return windmill list for the given farm, sorted alphabetically.

    Each row includes latest_anomaly: the potential_anomaly value of the most
    recent sensor reading (null if no readings or ML was unreachable).
    """
    farm = farm_repo.get_by_id(db, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")
    result = []
    for wm in windmill_repo.get_by_farm(db, farm_id):
        d = windmill_repo.windmill_to_dict(wm)
        row = db.execute(
            text(
                "SELECT potential_anomaly FROM sensor_readings "
                "WHERE windmill_id = :wid "
                "ORDER BY measurement_timestamp DESC LIMIT 1"
            ),
            {"wid": wm.windmill_id},
        ).fetchone()
        d["latest_anomaly"] = bool(row[0]) if row and row[0] is not None else None
        result.append(d)
    return result


@router.post("/windmills", status_code=201, summary="Create a windmill")
def create_windmill(body: WindmillCreate, db: Session = Depends(get_db)):
    """Create a new windmill. 409 if windmill_id already exists."""
    if not farm_repo.get_by_id(db, body.farm_id):
        raise HTTPException(status_code=404, detail="Farm not found.")
    if windmill_repo.get_by_windmill_id(db, body.windmill_id):
        write_notification("error", f"Windmill ID '{body.windmill_id}' already exists — creation failed.", "windmill", body.windmill_id)
        raise HTTPException(status_code=409, detail="This windmill ID is already in use.")
    wm = windmill_repo.create(db, body.model_dump())
    write_notification("info", f"Windmill '{wm.windmill_id}' created.", "windmill", wm.windmill_id)
    return windmill_repo.windmill_to_dict(wm)


@router.get("/windmills/{windmill_id}", summary="Get a windmill")
def get_windmill(windmill_id: str, db: Session = Depends(get_db)):
    """Return the full windmill object."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Windmill not found.")
    return windmill_repo.windmill_to_dict(wm)


@router.put("/windmills/{windmill_id}", summary="Update a windmill")
def update_windmill(windmill_id: str, body: WindmillUpdate, db: Session = Depends(get_db)):
    """Apply partial update. windmill_id and farm_id are immutable."""
    if not windmill_repo.get_by_windmill_id(db, windmill_id):
        raise HTTPException(status_code=404, detail="Windmill not found.")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = windmill_repo.update_windmill(db, windmill_id, updates)
    return windmill_repo.windmill_to_dict(updated)


@router.delete("/windmills/{windmill_id}", status_code=204, summary="Delete a windmill")
async def delete_windmill(windmill_id: str, db: Session = Depends(get_db)):
    """Delete a windmill. 409 if running. Sends type:error to open WS connections."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Windmill not found.")
    if wm.is_running:
        raise HTTPException(status_code=409, detail="Stop the windmill data stream before deleting it.")
    windmill_repo.delete(db, windmill_id)
    write_notification("info", f"Windmill '{windmill_id}' deleted.", "windmill", windmill_id)
    await ws_registry.close_all(windmill_id, {"type": "error", "message": "Windmill not found"})


@router.post("/windmills/{windmill_id}/start", summary="Start a windmill simulation")
async def start_windmill(windmill_id: str, db: Session = Depends(get_db)):
    """Start the simulation loop. 409 if already running."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Windmill not found.")
    if wm.is_running:
        raise HTTPException(status_code=409, detail="Windmill is already running.")
    windmill_repo.set_running(db, windmill_id, True)
    await sim.start(windmill_id, sim.beat_to_seconds(wm.sensor_beat, wm.sensor_beat_unit),
                    sim.beat_to_seconds(wm.location_beat, wm.location_beat_unit))
    return {"windmill_id": windmill_id, "is_running": True}


@router.post("/windmills/{windmill_id}/stop", summary="Stop a windmill simulation")
async def stop_windmill(windmill_id: str, db: Session = Depends(get_db)):
    """Stop the simulation loop. Idempotent."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Windmill not found.")
    windmill_repo.set_running(db, windmill_id, False)
    await sim.stop(windmill_id)
    return {"windmill_id": windmill_id, "is_running": False}


@router.post("/windmills/{windmill_id}/etl", summary="Run ETL for a windmill")
def windmill_etl(windmill_id: str, db: Session = Depends(get_db)):
    """Run incremental ETL from PostgreSQL to Parquet."""
    if not windmill_repo.get_by_windmill_id(db, windmill_id):
        raise HTTPException(status_code=404, detail="Windmill not found.")
    return parquet.run_etl(windmill_id, db)


@router.get("/windmills/{windmill_id}/history", summary="Get historical sensor data")
def get_history(windmill_id: str, scale: str = "minute", db: Session = Depends(get_db)):
    """Return Parquet-backed history at the requested scale."""
    wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Windmill not found.")
    if scale not in ("minute", "hour", "day", "week"):
        raise HTTPException(status_code=422, detail="scale must be minute, hour, day, or week.")
    return parquet.read_history(windmill_id, scale, windmill_repo.windmill_to_dict(wm))
