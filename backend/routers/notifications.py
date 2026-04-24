"""Notification list route."""
from fastapi import APIRouter
from infra.notifications import get_recent

router = APIRouter()


@router.get("/notifications", summary="Get recent notifications",
            description="Return the last 200 notification entries, newest first.")
def list_notifications():
    """Return last 200 notification log entries."""
    return get_recent(200)
