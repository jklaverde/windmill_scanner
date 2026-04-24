"""SSE endpoint: GET /notifications/stream"""
import json
import os
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from infra.notifications import tail_new_lines

router = APIRouter()
_KEEPALIVE_INTERVAL = 30


@router.get("/notifications/stream", summary="SSE notification stream",
            description="Server-sent events stream; pushes new notification entries in real time.")
async def notifications_stream():
    """Stream new notification log entries via SSE."""

    async def event_generator():
        log_path = os.getenv("LOG_FILE_PATH", "./data/notifications.jsonl")
        keepalive_task: asyncio.Task = asyncio.create_task(_keepalive_ticker())
        try:
            async for line in tail_new_lines(log_path):
                try:
                    entry = json.loads(line)
                    yield f"data: {json.dumps({'type': 'new_notification', 'entry': entry})}\n\n"
                except json.JSONDecodeError:
                    pass
                if keepalive_task.done():
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    keepalive_task = asyncio.create_task(_keepalive_ticker())
        finally:
            keepalive_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _keepalive_ticker():
    await asyncio.sleep(_KEEPALIVE_INTERVAL)
