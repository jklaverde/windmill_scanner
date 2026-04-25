"""Anomaly service health proxy endpoint."""
from fastapi import APIRouter, HTTPException
from infra import anomaly_client

router = APIRouter()


@router.get("/anomaly/health", summary="ML anomaly service health")
async def anomaly_health():
    """Proxy GET /api/v1/health from the anomaly detection service.

    Returns 503 if the service is unreachable or model is not loaded.
    """
    try:
        data = await anomaly_client.health()
    except Exception:
        raise HTTPException(status_code=503, detail="Anomaly service unreachable.")
    if not data.get("model_loaded"):
        raise HTTPException(status_code=503, detail="Anomaly service model not loaded.")
    return data
