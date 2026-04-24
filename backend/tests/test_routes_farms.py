"""Integration tests for farm CRUD routes."""


def test_list_farms_empty(client):
    resp = client.get("/farms")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_farm_returns_201(client):
    resp = client.post("/farms", json={"name": "Alpha Farm", "description": "First farm"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alpha Farm"
    assert data["description"] == "First farm"
    assert data["windmill_count"] == 0
    assert data["running_count"] == 0
    assert "id" in data


def test_create_farm_duplicate_name_returns_409(client):
    client.post("/farms", json={"name": "Bravo Farm", "description": ""})
    resp = client.post("/farms", json={"name": "Bravo Farm", "description": ""})
    assert resp.status_code == 409


def test_list_farms_after_create(client):
    client.post("/farms", json={"name": "Charlie Farm", "description": ""})
    client.post("/farms", json={"name": "Alpha Farm", "description": ""})
    resp = client.get("/farms")
    assert resp.status_code == 200
    names = [f["name"] for f in resp.json()]
    assert "Charlie Farm" in names
    assert "Alpha Farm" in names


def test_list_farms_sorted_alphabetically(client):
    client.post("/farms", json={"name": "Zulu Farm", "description": ""})
    client.post("/farms", json={"name": "Alpha Farm", "description": ""})
    resp = client.get("/farms")
    names = [f["name"] for f in resp.json()]
    assert names == sorted(names)


def test_delete_farm_returns_204(client):
    r = client.post("/farms", json={"name": "Delta Farm", "description": ""})
    farm_id = r.json()["id"]
    resp = client.delete(f"/farms/{farm_id}")
    assert resp.status_code == 204


def test_delete_farm_not_found_returns_404(client):
    resp = client.delete("/farms/9999")
    assert resp.status_code == 404


def test_delete_farm_with_windmills_returns_409(client):
    r = client.post("/farms", json={"name": "Echo Farm", "description": ""})
    farm_id = r.json()["id"]
    client.post("/windmills", json={
        "windmill_id": "wm-echo-1",
        "farm_id": farm_id,
        "name": "Echo-1",
        "description": "",
    })
    resp = client.delete(f"/farms/{farm_id}")
    assert resp.status_code == 409


def test_deleted_farm_not_in_list(client):
    r = client.post("/farms", json={"name": "Foxtrot Farm", "description": ""})
    farm_id = r.json()["id"]
    client.delete(f"/farms/{farm_id}")
    names = [f["name"] for f in client.get("/farms").json()]
    assert "Foxtrot Farm" not in names
