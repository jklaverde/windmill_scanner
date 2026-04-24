"""
Shared simulation helpers: asyncio loop coroutines + start/stop coordination.

Used by both windmill and farm HTTP routes to avoid circular imports.
"""
import asyncio
from datetime import datetime, timezone

from infra.db import SessionLocal
from infra import windmill_repo, sensor_repo, location_repo
from infra.notifications import write as write_notification
from domain import simulation
from routers import ws_registry, task_registry

_UNIT_SECONDS: dict[str, int] = {"ss": 1, "mm": 60, "hh": 3600, "dd": 86400}


def beat_to_seconds(beat: int, unit: str) -> int:
    """Convert beat integer + unit code to total seconds."""
    return beat * _UNIT_SECONDS.get(unit, 1)


async def _sensor_loop(windmill_id: str, beat_seconds: int) -> None:
    """Continuously generate sensor readings and broadcast via WebSocket."""
    try:
        while True:
            await asyncio.sleep(beat_seconds)

            db = SessionLocal()
            try:
                wm = windmill_repo.get_by_windmill_id(db, windmill_id)
            finally:
                db.close()

            if not wm:
                break

            configs = simulation.configs_from_windmill(wm)
            last = task_registry.get_last_values(windmill_id) or {}

            new_values: dict[str, float] = {}
            for sensor, cfg in configs.items():
                current = last.get(sensor, simulation.initial_seed(cfg))
                current = max(cfg.clamp_min, min(cfg.spike_max, current))
                new_values[sensor] = simulation.generate_value(current, cfg)

            task_registry.set_last_values(windmill_id, new_values)
            now = datetime.now(timezone.utc)

            def _insert(values: dict, ts: datetime) -> None:
                db2 = SessionLocal()
                try:
                    sensor_repo.insert_reading(
                        db2, windmill_id, ts,
                        values["temperature"], values["noise_level"],
                        values["humidity"], values["wind_speed"],
                    )
                finally:
                    db2.close()

            await asyncio.to_thread(_insert, new_values, now)

            payload = {
                "type": "reading",
                "windmill_id": windmill_id,
                "measurement_timestamp": now.isoformat(),
                "db_timestamp": now.isoformat(),
                "readings": {
                    "temperature": {"value": new_values["temperature"], "unit": "C"},
                    "noise_level":  {"value": new_values["noise_level"],  "unit": "dB"},
                    "humidity":     {"value": new_values["humidity"],     "unit": "%RH"},
                    "wind_speed":   {"value": new_values["wind_speed"],   "unit": "km/h"},
                },
            }
            await ws_registry.broadcast(windmill_id, payload)

    except asyncio.CancelledError:
        pass


async def _location_loop(windmill_id: str, beat_seconds: int) -> None:
    """Write a static location heartbeat each beat interval."""
    try:
        while True:
            await asyncio.sleep(beat_seconds)
            db = SessionLocal()
            try:
                wm = windmill_repo.get_by_windmill_id(db, windmill_id)
                if not wm:
                    break

                lat, lat_dir, lon, lon_dir = wm.lat, wm.lat_dir, wm.lon, wm.lon_dir

                def _insert_hb() -> None:
                    db2 = SessionLocal()
                    try:
                        now = datetime.now(timezone.utc)
                        location_repo.insert_heartbeat(
                            db2, windmill_id, now,
                            lat, lat_dir, lon, lon_dir,
                        )
                    finally:
                        db2.close()

                await asyncio.to_thread(_insert_hb)
            finally:
                db.close()

    except asyncio.CancelledError:
        pass


async def start(windmill_id: str, sensor_seconds: int, location_seconds: int) -> None:
    """Spawn simulation tasks and broadcast status:started to open WS connections."""
    sensor_task = asyncio.create_task(_sensor_loop(windmill_id, sensor_seconds))
    location_task = asyncio.create_task(_location_loop(windmill_id, location_seconds))
    task_registry.register_tasks(windmill_id, sensor_task, location_task)

    await ws_registry.broadcast(windmill_id, {
        "type": "status",
        "status": "started",
        "windmill_id": windmill_id,
        "message": f"Data Stream from windmill {windmill_id} started",
    })
    write_notification("info", f"Windmill {windmill_id} stream started.", "windmill", windmill_id)


async def stop(windmill_id: str) -> None:
    """Cancel simulation tasks and broadcast status:stopped to open WS connections."""
    task_registry.cancel_tasks(windmill_id)
    await ws_registry.broadcast(windmill_id, {
        "type": "status",
        "status": "stopped",
        "windmill_id": windmill_id,
        "message": f"Data Stream from windmill {windmill_id} stopped",
    })
    write_notification("info", f"Windmill {windmill_id} stream stopped.", "windmill", windmill_id)
