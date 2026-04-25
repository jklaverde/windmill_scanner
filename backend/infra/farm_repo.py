from sqlalchemy import func, text
from sqlalchemy.orm import Session
from domain.models import Farm, Windmill


def get_all(db: Session) -> list[dict]:
    """Return all farms sorted alphabetically by name, with windmill counts."""
    farms = db.query(Farm).order_by(Farm.name.asc()).all()
    result = []
    for farm in farms:
        wc = db.query(func.count(Windmill.id)).filter(Windmill.farm_id == farm.id).scalar() or 0
        rc = db.query(func.count(Windmill.id)).filter(
            Windmill.farm_id == farm.id, Windmill.is_running.is_(True)
        ).scalar() or 0
        has_anomaly = db.execute(
            text("""
                SELECT EXISTS (
                    SELECT 1 FROM (
                        SELECT DISTINCT ON (sr.windmill_id)
                            sr.potential_anomaly
                        FROM sensor_readings sr
                        JOIN windmills w ON w.windmill_id = sr.windmill_id
                        WHERE w.farm_id = :fid
                        ORDER BY sr.windmill_id, sr.measurement_timestamp DESC
                    ) latest
                    WHERE latest.potential_anomaly = true
                )
            """),
            {"fid": farm.id},
        ).scalar() or False
        result.append({
            "id": farm.id,
            "name": farm.name,
            "description": farm.description,
            "windmill_count": wc,
            "running_count": rc,
            "has_anomaly": bool(has_anomaly),
            "created_at": farm.created_at,
        })
    return result


def get_by_id(db: Session, farm_id: int) -> Farm | None:
    """Fetch a farm by its integer primary key."""
    return db.query(Farm).filter(Farm.id == farm_id).first()


def get_by_name(db: Session, name: str) -> Farm | None:
    """Fetch a farm by its unique name."""
    return db.query(Farm).filter(Farm.name == name).first()


def create(db: Session, name: str, description: str) -> Farm:
    """Insert a new farm and return the persisted instance."""
    farm = Farm(name=name, description=description)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


def delete(db: Session, farm_id: int) -> None:
    """Delete a farm by id (caller must verify no windmills remain)."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if farm:
        db.delete(farm)
        db.commit()


def get_windmills(db: Session, farm_id: int) -> list[Windmill]:
    """Return all windmills belonging to farm_id."""
    return db.query(Windmill).filter(Windmill.farm_id == farm_id).all()
