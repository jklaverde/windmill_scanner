"""JSONL notification log — writer, reader, and async SSE file tailer."""
import json
import os
import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator

_LOG_FILE_PATH: str | None = None


def _path() -> str:
    """Resolve log file path from env (cached after first call)."""
    global _LOG_FILE_PATH
    if _LOG_FILE_PATH is None:
        _LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", "./data/notifications.jsonl")
    return _LOG_FILE_PATH


def write(
    level: str,
    message: str,
    entity_type: str,
    entity_id: str | int | None = None,
) -> None:
    """Append one notification entry to the JSONL log file."""
    path = _path()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "level": level,
        "message": message,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id is not None else None,
    }
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def get_recent(n: int = 200) -> list[dict]:
    """Return the last n entries from the log, newest first."""
    path = _path()
    if not os.path.exists(path):
        return []
    entries: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return list(reversed(entries[-n:]))


async def tail_new_lines(path: str) -> AsyncGenerator[str, None]:
    """Async generator that yields new lines appended to path.

    Seeks to end on open; polls every 100 ms for new content.
    Creates the file if it does not exist.
    """
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        open(path, "a").close()
    with open(path, "r", encoding="utf-8") as f:
        f.seek(0, 2)  # seek to end
        while True:
            line = f.readline()
            if line:
                line = line.strip()
                if line:
                    yield line
            else:
                await asyncio.sleep(0.1)
