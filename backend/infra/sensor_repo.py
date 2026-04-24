from datetime import datetime
from sqlalchemy.orm import Session
from domain.models import SensorReading


def insert_reading(
    db: Session,
    windmill_id: str,
    measurement_timestamp: datetime,
    temperature: float,
    noise_level: float,
    humidity: float,
    wind_speed: float,
) -> SensorReading:
    """Insert a sensor reading row and return the persisted instance."""
    reading = SensorReading(
        windmill_id=windmill_id,
        measurement_timestamp=measurement_timestamp,
        temperature=temperature,
        noise_level=noise_level,
        humidity=humidity,
        wind_speed=wind_speed,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def query_since(db: Session, windmill_id: str, cutoff: datetime) -> list[SensorReading]:
    """Return all readings for windmill_id after cutoff, ordered ASC."""
    return (
        db.query(SensorReading)
        .filter(
            SensorReading.windmill_id == windmill_id,
            SensorReading.measurement_timestamp > cutoff,
        )
        .order_by(SensorReading.measurement_timestamp.asc())
        .all()
    )
