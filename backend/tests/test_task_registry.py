"""Tests for the asyncio task registry."""
import asyncio
import pytest

from routers.task_registry import (
    task_registry,
    get_last_values,
    set_last_values,
    register_tasks,
    cancel_tasks,
    is_running,
)


@pytest.fixture(autouse=True)
def clear_registry():
    task_registry.clear()
    yield
    task_registry.clear()


def test_get_last_values_unknown_windmill():
    assert get_last_values("nonexistent") is None


def test_set_and_get_last_values_roundtrip():
    values = {"temperature": 25.0, "noise_level": 30.0, "humidity": 60.0, "wind_speed": 10.0}
    set_last_values("wm-1", values)
    assert get_last_values("wm-1") == values


def test_set_last_values_overwrites_previous():
    set_last_values("wm-1", {"temperature": 10.0})
    set_last_values("wm-1", {"temperature": 99.0})
    assert get_last_values("wm-1") == {"temperature": 99.0}


def test_is_running_false_when_no_entry():
    assert is_running("wm-1") is False


async def test_is_running_true_while_task_alive():
    async def _forever():
        await asyncio.sleep(9999)

    sensor = asyncio.create_task(_forever())
    location = asyncio.create_task(_forever())
    register_tasks("wm-1", sensor, location)

    assert is_running("wm-1") is True

    sensor.cancel()
    location.cancel()
    await asyncio.sleep(0)


async def test_cancel_tasks_cancels_both():
    async def _forever():
        await asyncio.sleep(9999)

    sensor = asyncio.create_task(_forever())
    location = asyncio.create_task(_forever())
    register_tasks("wm-1", sensor, location)

    cancel_tasks("wm-1")
    await asyncio.sleep(0)

    assert sensor.cancelled()
    assert location.cancelled()


def test_cancel_tasks_noop_for_unknown_windmill():
    cancel_tasks("nonexistent")  # must not raise


def test_cancel_tasks_preserves_last_values():
    set_last_values("wm-1", {"temperature": 42.0})
    cancel_tasks("wm-1")
    assert get_last_values("wm-1") == {"temperature": 42.0}


async def test_is_running_false_after_cancel():
    async def _forever():
        await asyncio.sleep(9999)

    sensor = asyncio.create_task(_forever())
    location = asyncio.create_task(_forever())
    register_tasks("wm-1", sensor, location)

    cancel_tasks("wm-1")
    await asyncio.sleep(0)

    assert is_running("wm-1") is False
