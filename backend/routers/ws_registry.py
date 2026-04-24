"""
Module-level WebSocket connection registry.

Deliberate exception to the no-module-singletons rule — asyncio single-process
guarantees no race conditions without locking.
"""
from starlette.websockets import WebSocket

active_connections: dict[str, list[WebSocket]] = {}


def register(windmill_id: str, ws: WebSocket) -> None:
    """Add a WebSocket connection for windmill_id."""
    active_connections.setdefault(windmill_id, []).append(ws)


def unregister(windmill_id: str, ws: WebSocket) -> None:
    """Remove a WebSocket connection for windmill_id."""
    conns = active_connections.get(windmill_id, [])
    if ws in conns:
        conns.remove(ws)


async def broadcast(windmill_id: str, payload: dict) -> None:
    """Push payload to every open connection for windmill_id.

    Silently removes broken connections so a dead socket never aborts the loop.
    """
    for ws in list(active_connections.get(windmill_id, [])):
        try:
            await ws.send_json(payload)
        except Exception:
            unregister(windmill_id, ws)


async def close_all(windmill_id: str, error_payload: dict) -> None:
    """Send error_payload then close every connection for windmill_id (used on delete)."""
    for ws in list(active_connections.get(windmill_id, [])):
        try:
            await ws.send_json(error_payload)
            await ws.close()
        except Exception:
            pass
    active_connections.pop(windmill_id, None)
