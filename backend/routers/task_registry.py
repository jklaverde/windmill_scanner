"""
Module-level task registry — stores asyncio task handles and last sensor values
per windmill_id.

Structure per entry:
{
    "sensor_task":   asyncio.Task | None,
    "location_task": asyncio.Task | None,
    "last_values":   {"temperature": float, "noise_level": float,
                      "humidity": float, "wind_speed": float} | None,
}
"""
import asyncio

task_registry: dict[str, dict] = {}


def get_last_values(windmill_id: str) -> dict | None:
    """Return the last emitted sensor values for windmill_id, or None."""
    entry = task_registry.get(windmill_id)
    return entry.get("last_values") if entry else None


def set_last_values(windmill_id: str, values: dict) -> None:
    """Persist last sensor values (called after each generated reading)."""
    task_registry.setdefault(windmill_id, {})["last_values"] = values


def register_tasks(windmill_id: str, sensor_task: asyncio.Task, location_task: asyncio.Task) -> None:
    """Store task handles for a windmill."""
    entry = task_registry.setdefault(windmill_id, {})
    entry["sensor_task"] = sensor_task
    entry["location_task"] = location_task


def cancel_tasks(windmill_id: str) -> None:
    """Cancel both tasks for windmill_id; preserve last_values."""
    entry = task_registry.get(windmill_id)
    if not entry:
        return
    for key in ("sensor_task", "location_task"):
        task = entry.get(key)
        if task and not task.done():
            task.cancel()
        entry.pop(key, None)


def is_running(windmill_id: str) -> bool:
    """True if the sensor task exists and has not finished."""
    entry = task_registry.get(windmill_id)
    if not entry:
        return False
    task = entry.get("sensor_task")
    return bool(task and not task.done())
