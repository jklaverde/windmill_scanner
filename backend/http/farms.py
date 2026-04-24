"""Farm management routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from infra.db import get_db
from infra import farm_repo, parquet
from infra.notifications import write as write_notification
from http import simulation as sim

router = APIRouter()


class FarmCreate(BaseModel):
    name: str = Field(..., max_length=60)
    description: str = Field(..., max_length=100)


def _farm_has_running(db: Session, farm_id: int) -> bool:
    windmills = farm_repo.get_windmills(db, farm_id)
    return any(w.is_running for w in windmills)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("/farms", summary="List all farms", description="Return all farms sorted alphabetically by name.")
def list_farms(db: Session = Depends(get_db)):
    """Return farm list with windmill_count and running_count."""
    return farm_repo.get_all(db)


@router.post("/farms", status_code=201, summary="Create a farm")
def create_farm(body: FarmCreate, db: Session = Depends(get_db)):
    """Create a new farm. 409 if name already exists."""
    if farm_repo.get_by_name(db, body.name):
        write_notification(
            "error",
            f"Farm name '{body.name}' already exists — creation failed.",
            "farm",
        )
        raise HTTPException(status_code=409, detail="A farm with this name already exists.")
    farm = farm_repo.create(db, body.name, body.description)
    write_notification("info", f"Farm '{farm.name}' created.", "farm", farm.id)
    return {
        "id": farm.id,
        "name": farm.name,
        "description": farm.description,
        "windmill_count": 0,
        "running_count": 0,
        "created_at": farm.created_at,
    }


@router.delete("/farms/{farm_id}", status_code=204, summary="Delete a farm")
def delete_farm(farm_id: int, db: Session = Depends(get_db)):
    """Delete a farm. 409 if it still has windmills."""
    farm = farm_repo.get_by_id(db, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")
    if farm_repo.get_windmills(db, farm_id):
        raise HTTPException(
            status_code=409,
            detail="Remove all windmills from this farm before deleting it.",
        )
    name = farm.name
    farm_repo.delete(db, farm_id)
    write_notification("info", f"Farm '{name}' deleted.", "farm", farm_id)


# ---------------------------------------------------------------------------
# Control
# ---------------------------------------------------------------------------

@router.post("/farms/{farm_id}/start", summary="Start all windmills in a farm")
async def start_farm(farm_id: int, db: Session = Depends(get_db)):
    """Best-effort: start each stopped windmill; continue on individual errors."""
    farm = farm_repo.get_by_id(db, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    windmills = farm_repo.get_windmills(db, farm_id)
    started: list[str] = []
    already_running: list[str] = []
    errors: list[dict] = []

    from infra import windmill_repo
    for wm in windmills:
        try:
            if wm.is_running:
                already_running.append(wm.windmill_id)
                continue
            windmill_repo.set_running(db, wm.windmill_id, True)
            sensor_s = sim.beat_to_seconds(wm.sensor_beat, wm.sensor_beat_unit)
            location_s = sim.beat_to_seconds(wm.location_beat, wm.location_beat_unit)
            await sim.start(wm.windmill_id, sensor_s, location_s)
            started.append(wm.windmill_id)
        except Exception as exc:
            errors.append({"windmill_id": wm.windmill_id, "reason": str(exc)})

    return {"started": started, "already_running": already_running, "errors": errors}


@router.post("/farms/{farm_id}/stop", summary="Stop all windmills in a farm")
async def stop_farm(farm_id: int, db: Session = Depends(get_db)):
    """Best-effort: stop each windmill (idempotent); continue on individual errors."""
    farm = farm_repo.get_by_id(db, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    windmills = farm_repo.get_windmills(db, farm_id)
    stopped: list[str] = []
    errors: list[dict] = []

    from infra import windmill_repo
    for wm in windmills:
        try:
            windmill_repo.set_running(db, wm.windmill_id, False)
            await sim.stop(wm.windmill_id)
            stopped.append(wm.windmill_id)
        except Exception as exc:
            errors.append({"windmill_id": wm.windmill_id, "reason": str(exc)})

    return {"stopped": stopped, "errors": errors}


@router.post("/farms/{farm_id}/etl", summary="Run ETL for all windmills in a farm")
def farm_etl(farm_id: int, db: Session = Depends(get_db)):
    """Run incremental ETL for each windmill sequentially; best-effort."""
    farm = farm_repo.get_by_id(db, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    windmills = farm_repo.get_windmills(db, farm_id)
    succeeded: list[str] = []
    errors: list[dict] = []

    for wm in windmills:
        try:
            parquet.run_etl(wm.windmill_id, db)
            succeeded.append(wm.windmill_id)
        except Exception as exc:
            errors.append({"windmill_id": wm.windmill_id, "reason": str(exc)})

    return {"succeeded": succeeded, "errors": errors}
