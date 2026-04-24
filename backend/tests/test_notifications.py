"""Tests for the JSONL notification log."""
import json
import os
import pytest

import infra.notifications as _mod


@pytest.fixture()
def log_path(tmp_path):
    path = str(tmp_path / "notifications.jsonl")
    original = _mod._LOG_FILE_PATH
    _mod._LOG_FILE_PATH = path
    yield path
    _mod._LOG_FILE_PATH = original


def test_write_creates_file(log_path):
    _mod.write("info", "hello", "system")
    assert os.path.exists(log_path)


def test_write_produces_valid_json(log_path):
    _mod.write("error", "something failed", "windmill", "wm-1")
    with open(log_path) as f:
        entry = json.loads(f.read().strip())
    assert entry["level"] == "error"
    assert entry["message"] == "something failed"
    assert entry["entity_type"] == "windmill"
    assert entry["entity_id"] == "wm-1"


def test_write_appends_multiple_lines(log_path):
    _mod.write("info", "first", "system")
    _mod.write("info", "second", "system")
    with open(log_path) as f:
        lines = [l for l in f.read().splitlines() if l.strip()]
    assert len(lines) == 2


def test_entity_id_is_none_when_not_provided(log_path):
    _mod.write("info", "farm created", "farm")
    entries = _mod.get_recent(1)
    assert entries[0]["entity_id"] is None


def test_entity_id_stringified_from_int(log_path):
    _mod.write("info", "windmill created", "windmill", 42)
    entries = _mod.get_recent(1)
    assert entries[0]["entity_id"] == "42"


def test_get_recent_returns_newest_first(log_path):
    _mod.write("info", "first", "system")
    _mod.write("info", "second", "system")
    _mod.write("info", "third", "system")
    entries = _mod.get_recent(10)
    assert entries[0]["message"] == "third"
    assert entries[-1]["message"] == "first"


def test_get_recent_respects_n_limit(log_path):
    for i in range(10):
        _mod.write("info", f"msg {i}", "system")
    assert len(_mod.get_recent(5)) == 5


def test_get_recent_empty_when_file_missing():
    original = _mod._LOG_FILE_PATH
    _mod._LOG_FILE_PATH = "/nonexistent/path/test.jsonl"
    try:
        assert _mod.get_recent(10) == []
    finally:
        _mod._LOG_FILE_PATH = original


def test_timestamp_field_present(log_path):
    _mod.write("info", "check", "system")
    entries = _mod.get_recent(1)
    assert "timestamp" in entries[0]
    assert entries[0]["timestamp"].endswith("Z")
