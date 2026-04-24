from datetime import datetime
from sqlalchemy.orm import Session
from domain.models import LocationHeartbeat


def insert_heartbeat(
    db: Session,
    windmill_id: str,
    measurement_timestamp: datetime,
    lat: float,
    lat_dir: str,
    lon: float,
    lon_dir: str,
) -> LocationHeartbeat:
    """Insert a location heartbeat row."""
    hb = LocationHeartbeat(
        windmill_id=windmill_id,
        measurement_timestamp=measurement_timestamp,
        lat=lat,
        lat_dir=lat_dir,
        lon=lon,
        lon_dir=lon_dir,
    )
    db.add(hb)
    db.commit()
    return hb
