"""Tests for the WebSocket connection registry."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from routers.ws_registry import active_connections, register, unregister, broadcast, close_all


@pytest.fixture(autouse=True)
def clear_connections():
    active_connections.clear()
    yield
    active_connections.clear()


def _mock_ws():
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


def test_register_adds_connection():
    ws = _mock_ws()
    register("wm-1", ws)
    assert ws in active_connections["wm-1"]


def test_register_multiple_connections_same_windmill():
    ws1, ws2 = _mock_ws(), _mock_ws()
    register("wm-1", ws1)
    register("wm-1", ws2)
    assert len(active_connections["wm-1"]) == 2


def test_unregister_removes_connection():
    ws = _mock_ws()
    register("wm-1", ws)
    unregister("wm-1", ws)
    assert ws not in active_connections.get("wm-1", [])


def test_unregister_noop_when_not_registered():
    unregister("nonexistent", _mock_ws())  # must not raise


async def test_broadcast_sends_to_all_connections():
    ws1, ws2 = _mock_ws(), _mock_ws()
    register("wm-1", ws1)
    register("wm-1", ws2)
    payload = {"type": "reading"}

    await broadcast("wm-1", payload)

    ws1.send_json.assert_awaited_once_with(payload)
    ws2.send_json.assert_awaited_once_with(payload)


async def test_broadcast_removes_broken_connection():
    ws_good = _mock_ws()
    ws_bad = _mock_ws()
    ws_bad.send_json.side_effect = RuntimeError("disconnected")

    register("wm-1", ws_good)
    register("wm-1", ws_bad)
    await broadcast("wm-1", {"type": "reading"})

    assert ws_bad not in active_connections.get("wm-1", [])
    assert ws_good in active_connections["wm-1"]


async def test_broadcast_noop_for_unknown_windmill():
    await broadcast("nonexistent", {"type": "reading"})  # must not raise


async def test_close_all_sends_error_and_closes():
    ws = _mock_ws()
    register("wm-1", ws)
    payload = {"type": "error", "message": "Windmill not found"}

    await close_all("wm-1", payload)

    ws.send_json.assert_awaited_once_with(payload)
    ws.close.assert_awaited_once()


async def test_close_all_removes_windmill_entry():
    register("wm-1", _mock_ws())
    await close_all("wm-1", {"type": "error", "message": "gone"})
    assert "wm-1" not in active_connections
