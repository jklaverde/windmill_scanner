"""WebSocket handler: ws://{host}/ws/{windmill_id}"""
from fastapi import APIRouter
from starlette.websockets import WebSocket, WebSocketDisconnect

from infra.db import SessionLocal
from infra import windmill_repo
from http import ws_registry

router = APIRouter()


@router.websocket("/ws/{windmill_id}")
async def ws_endpoint(windmill_id: str, websocket: WebSocket):
    """
    Accept WebSocket connections for a windmill.

    On connect:
      - Unknown windmill_id → send type:error, close (client treats as permanent failure).
      - Stopped windmill    → send status:stopped, keep connection open.
      - Running windmill    → send status:started, then readings arrive via sensor loop.
    """
    await websocket.accept()

    db = SessionLocal()
    try:
        wm = windmill_repo.get_by_windmill_id(db, windmill_id)
    finally:
        db.close()

    if not wm:
        await websocket.send_json({"type": "error", "message": "Windmill not found"})
        await websocket.close()
        return

    ws_registry.register(windmill_id, websocket)

    # Immediately communicate current state to the connecting client
    if wm.is_running:
        await websocket.send_json({
            "type": "status",
            "status": "started",
            "windmill_id": windmill_id,
            "message": f"Data Stream from windmill {windmill_id} started",
        })
    else:
        await websocket.send_json({
            "type": "status",
            "status": "stopped",
            "windmill_id": windmill_id,
            "message": f"Data Stream from windmill {windmill_id} stopped",
        })

    try:
        # Hold the connection open; the sensor loop pushes readings via broadcast()
        while True:
            await websocket.receive_text()  # client never sends, but this keeps the coroutine alive
    except WebSocketDisconnect:
        pass
    finally:
        ws_registry.unregister(windmill_id, websocket)
