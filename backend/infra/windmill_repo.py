from sqlalchemy.orm import Session
from sqlalchemy import update
from domain.models import Windmill


def get_by_farm(db: Session, farm_id: int) -> list[Windmill]:
    """Return windmills for a farm, sorted alphabetically by name."""
    return db.query(Windmill).filter(Windmill.farm_id == farm_id).order_by(Windmill.name.asc()).all()


def get_by_windmill_id(db: Session, windmill_id: str) -> Windmill | None:
    """Fetch a windmill by its string windmill_id."""
    return db.query(Windmill).filter(Windmill.windmill_id == windmill_id).first()


def get_by_name_in_farm(db: Session, name: str, farm_id: int) -> Windmill | None:
    """Check for duplicate name within a farm (names are not globally unique)."""
    return db.query(Windmill).filter(Windmill.name == name, Windmill.farm_id == farm_id).first()


def create(db: Session, data: dict) -> Windmill:
    """Insert a new windmill and return the persisted instance."""
    wm = Windmill(**data)
    db.add(wm)
    db.commit()
    db.refresh(wm)
    return wm


def update_windmill(db: Session, windmill_id: str, data: dict) -> Windmill | None:
    """Apply partial update to a windmill and return the updated instance."""
    wm = get_by_windmill_id(db, windmill_id)
    if not wm:
        return None
    for key, value in data.items():
        setattr(wm, key, value)
    db.commit()
    db.refresh(wm)
    return wm


def delete(db: Session, windmill_id: str) -> None:
    """Delete a windmill (caller must verify it is stopped)."""
    wm = get_by_windmill_id(db, windmill_id)
    if wm:
        db.delete(wm)
        db.commit()


def set_running(db: Session, windmill_id: str, is_running: bool) -> Windmill | None:
    """Flip the is_running flag on a windmill."""
    wm = get_by_windmill_id(db, windmill_id)
    if wm:
        wm.is_running = is_running
        db.commit()
        db.refresh(wm)
    return wm


def reset_all_running(db: Session) -> None:
    """Reset all is_running flags to False (called at startup)."""
    db.execute(update(Windmill).values(is_running=False))
    db.commit()


def windmill_to_dict(wm: Windmill) -> dict:
    """Serialize a Windmill ORM instance to a plain dict for API responses."""
    return {
        "id": wm.id,
        "windmill_id": wm.windmill_id,
        "name": wm.name,
        "description": wm.description,
        "farm_id": wm.farm_id,
        "is_running": wm.is_running,
        "sensor_beat": wm.sensor_beat,
        "sensor_beat_unit": wm.sensor_beat_unit,
        "location_beat": wm.location_beat,
        "location_beat_unit": wm.location_beat_unit,
        "lat": wm.lat,
        "lat_dir": wm.lat_dir,
        "lon": wm.lon,
        "lon_dir": wm.lon_dir,
        "temp_clamp_min": wm.temp_clamp_min,
        "temp_normal_min": wm.temp_normal_min,
        "temp_normal_max": wm.temp_normal_max,
        "temp_spike_max": wm.temp_spike_max,
        "noise_clamp_min": wm.noise_clamp_min,
        "noise_normal_min": wm.noise_normal_min,
        "noise_normal_max": wm.noise_normal_max,
        "noise_spike_max": wm.noise_spike_max,
        "humidity_clamp_min": wm.humidity_clamp_min,
        "humidity_normal_min": wm.humidity_normal_min,
        "humidity_normal_max": wm.humidity_normal_max,
        "humidity_spike_max": wm.humidity_spike_max,
        "wind_clamp_min": wm.wind_clamp_min,
        "wind_normal_min": wm.wind_normal_min,
        "wind_normal_max": wm.wind_normal_max,
        "wind_spike_max": wm.wind_spike_max,
        "temp_rate": wm.temp_rate,
        "noise_rate": wm.noise_rate,
        "humidity_rate": wm.humidity_rate,
        "wind_rate": wm.wind_rate,
        "created_at": wm.created_at,
    }
