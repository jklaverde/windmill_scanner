"""Integration tests for windmill CRUD and control routes."""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.fixture()
def farm_id(client):
    r = client.post("/farms", json={"name": "Test Farm", "description": ""})
    return r.json()["id"]


@pytest.fixture()
def base_payload(farm_id):
    return {
        "windmill_id": "wm-test-1",
        "farm_id": farm_id,
        "name": "Test Windmill",
        "description": "A test windmill",
    }


@pytest.fixture()
def created_windmill(client, base_payload):
    client.post("/windmills", json=base_payload)
    return base_payload["windmill_id"]


# ── List ─────────────────────────────────────────────────────────────────────

def test_list_windmills_empty(client, farm_id):
    resp = client.get(f"/farms/{farm_id}/windmills")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_windmills_unknown_farm_returns_404(client):
    assert client.get("/farms/9999/windmills").status_code == 404


# ── Create ───────────────────────────────────────────────────────────────────

def test_create_windmill_returns_201(client, base_payload):
    resp = client.post("/windmills", json=base_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["windmill_id"] == "wm-test-1"
    assert data["is_running"] is False
    assert data["name"] == "Test Windmill"


def test_create_windmill_duplicate_id_returns_409(client, base_payload):
    client.post("/windmills", json=base_payload)
    resp = client.post("/windmills", json=base_payload)
    assert resp.status_code == 409


def test_create_windmill_invalid_id_characters_returns_422(client, farm_id):
    resp = client.post("/windmills", json={
        "windmill_id": "bad id!", "farm_id": farm_id, "name": "X", "description": "",
    })
    assert resp.status_code == 422


def test_create_windmill_unknown_farm_returns_404(client):
    resp = client.post("/windmills", json={
        "windmill_id": "wm-orphan", "farm_id": 9999, "name": "X", "description": "",
    })
    assert resp.status_code == 404


def test_create_windmill_appears_in_farm_list(client, base_payload, farm_id):
    client.post("/windmills", json=base_payload)
    ids = [w["windmill_id"] for w in client.get(f"/farms/{farm_id}/windmills").json()]
    assert "wm-test-1" in ids


# ── Get / Update ─────────────────────────────────────────────────────────────

def test_get_windmill(client, created_windmill):
    resp = client.get(f"/windmills/{created_windmill}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Windmill"


def test_get_windmill_not_found_returns_404(client):
    assert client.get("/windmills/nonexistent").status_code == 404


def test_update_windmill_name(client, created_windmill):
    resp = client.put(f"/windmills/{created_windmill}", json={"name": "Updated Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


def test_update_windmill_not_found_returns_404(client):
    assert client.put("/windmills/nonexistent", json={"name": "x"}).status_code == 404


# ── Delete ───────────────────────────────────────────────────────────────────

def test_delete_windmill_returns_204(client, created_windmill):
    assert client.delete(f"/windmills/{created_windmill}").status_code == 204


def test_delete_windmill_not_found_returns_404(client):
    assert client.delete("/windmills/nonexistent").status_code == 404


def test_delete_windmill_while_running_returns_409(client, base_payload):
    client.post("/windmills", json=base_payload)
    with patch("routers.simulation.start", new_callable=AsyncMock):
        client.post(f"/windmills/{base_payload['windmill_id']}/start")
    resp = client.delete(f"/windmills/{base_payload['windmill_id']}")
    assert resp.status_code == 409


# ── Start / Stop ─────────────────────────────────────────────────────────────

def test_start_windmill(client, base_payload):
    client.post("/windmills", json=base_payload)
    with patch("routers.simulation.start", new_callable=AsyncMock):
        resp = client.post(f"/windmills/{base_payload['windmill_id']}/start")
    assert resp.status_code == 200
    assert resp.json()["is_running"] is True


def test_start_windmill_not_found_returns_404(client):
    assert client.post("/windmills/nonexistent/start").status_code == 404


def test_start_windmill_already_running_returns_409(client, base_payload):
    client.post("/windmills", json=base_payload)
    wm_id = base_payload["windmill_id"]
    with patch("routers.simulation.start", new_callable=AsyncMock):
        client.post(f"/windmills/{wm_id}/start")
    with patch("routers.simulation.start", new_callable=AsyncMock):
        resp = client.post(f"/windmills/{wm_id}/start")
    assert resp.status_code == 409


def test_stop_windmill(client, base_payload):
    client.post("/windmills", json=base_payload)
    wm_id = base_payload["windmill_id"]
    with patch("routers.simulation.start", new_callable=AsyncMock):
        client.post(f"/windmills/{wm_id}/start")
    with patch("routers.simulation.stop", new_callable=AsyncMock):
        resp = client.post(f"/windmills/{wm_id}/stop")
    assert resp.status_code == 200
    assert resp.json()["is_running"] is False


def test_stop_windmill_not_found_returns_404(client):
    assert client.post("/windmills/nonexistent/stop").status_code == 404


# ── History ───────────────────────────────────────────────────────────────────

def test_get_history_invalid_scale_returns_422(client, created_windmill):
    resp = client.get(f"/windmills/{created_windmill}/history?scale=invalid")
    assert resp.status_code == 422


def test_get_history_returns_empty_list_when_no_parquet(client, created_windmill):
    resp = client.get(f"/windmills/{created_windmill}/history?scale=minute")
    assert resp.status_code == 200
    assert resp.json() == []
