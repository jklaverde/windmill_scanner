"""Async HTTP client for the Wind Turbine Anomaly Detection service."""
import os
import httpx

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        base_url = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8001")
        _client = httpx.AsyncClient(base_url=base_url)
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def predict(
    turbine_id: str,
    measurement_timestamp: str,
    temperature: float,
    humidity: float,
    noise_level: float,
) -> dict:
    """Call /api/v1/predict. Returns {"potential_anomaly": bool, "probability": float}."""
    resp = await _get_client().post(
        "/api/v1/predict",
        json={
            "turbine_id": turbine_id,
            "measurement_timestamp": measurement_timestamp,
            "temperature": temperature,
            "humidity": humidity,
            "noise_level": noise_level,
        },
    )
    resp.raise_for_status()
    return resp.json()


async def health() -> dict:
    """Call /api/v1/health. Returns {"status": ..., "model_loaded": bool, "timestamp": ...}."""
    resp = await _get_client().get("/api/v1/health")
    resp.raise_for_status()
    return resp.json()
