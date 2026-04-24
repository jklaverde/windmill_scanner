"""Tests for incremental ETL and history reading."""
import pytest
import pandas as pd
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import infra.parquet as _mod


@pytest.fixture()
def parquet_dir(tmp_path):
    original = _mod._PARQUET_DATA_PATH
    _mod._PARQUET_DATA_PATH = str(tmp_path)
    yield tmp_path
    _mod._PARQUET_DATA_PATH = original


def _row(ts, temp=25.0, noise=30.0, hum=60.0, wind=10.0):
    class R:
        measurement_timestamp = ts
        temperature = temp
        noise_level = noise
        humidity = hum
        wind_speed = wind
    return R()


_WM_CONFIG = {
    "temp_clamp_min": 0.0, "temp_spike_max": 200.0,
    "noise_clamp_min": 0.0, "noise_spike_max": 180.0,
    "humidity_clamp_min": 0.0, "humidity_spike_max": 99.0,
    "wind_clamp_min": 0.0, "wind_spike_max": 200.0,
}


def test_run_etl_creates_parquet_file(parquet_dir):
    ts = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    with patch("infra.parquet.query_since", return_value=[_row(ts)]):
        with patch("infra.parquet.write_notification"):
            result = _mod.run_etl("wm-1", db=None)
    assert result["rows_written"] == 1
    assert (parquet_dir / "wm-1.parquet").exists()


def test_run_etl_returns_zero_when_no_new_rows(parquet_dir):
    with patch("infra.parquet.query_since", return_value=[]):
        with patch("infra.parquet.write_notification"):
            result = _mod.run_etl("wm-1", db=None)
    assert result["rows_written"] == 0


def test_run_etl_incremental_appends_without_duplicating(parquet_dir):
    ts1 = datetime(2024, 1, 1, 10, 0, tzinfo=timezone.utc)
    ts2 = datetime(2024, 1, 1, 11, 0, tzinfo=timezone.utc)

    with patch("infra.parquet.query_since", return_value=[_row(ts1)]):
        with patch("infra.parquet.write_notification"):
            _mod.run_etl("wm-1", db=None)

    with patch("infra.parquet.query_since", return_value=[_row(ts2)]):
        with patch("infra.parquet.write_notification"):
            result = _mod.run_etl("wm-1", db=None)

    assert result["rows_written"] == 1
    df = pd.read_parquet(str(parquet_dir / "wm-1.parquet"))
    assert len(df) == 2


def test_read_history_empty_when_no_file(parquet_dir):
    assert _mod.read_history("nonexistent", "minute", _WM_CONFIG) == []


def test_read_history_minute_returns_rows_within_window(parquet_dir):
    now = datetime.now(timezone.utc)
    df = pd.DataFrame([
        {"measurement_timestamp": now - timedelta(seconds=30), "temperature": 25.0, "noise_level": 30.0, "humidity": 60.0, "wind_speed": 10.0},
        {"measurement_timestamp": now - timedelta(hours=2),    "temperature": 20.0, "noise_level": 25.0, "humidity": 55.0, "wind_speed": 8.0},
    ])
    df.to_parquet(str(parquet_dir / "wm-1.parquet"), index=False)

    result = _mod.read_history("wm-1", "minute", _WM_CONFIG)
    assert len(result) == 1
    assert result[0]["temperature"] == pytest.approx(25.0)


def test_read_history_returns_empty_when_no_rows_in_window(parquet_dir):
    now = datetime.now(timezone.utc)
    df = pd.DataFrame([
        {"measurement_timestamp": now - timedelta(hours=5), "temperature": 20.0, "noise_level": 25.0, "humidity": 55.0, "wind_speed": 8.0},
    ])
    df.to_parquet(str(parquet_dir / "wm-1.parquet"), index=False)
    assert _mod.read_history("wm-1", "minute", _WM_CONFIG) == []


def test_file_exists_false_when_absent(parquet_dir):
    assert _mod.file_exists("nonexistent") is False


def test_file_exists_true_after_etl(parquet_dir):
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
    with patch("infra.parquet.query_since", return_value=[_row(ts)]):
        with patch("infra.parquet.write_notification"):
            _mod.run_etl("wm-1", db=None)
    assert _mod.file_exists("wm-1") is True


def test_delete_file_removes_parquet(parquet_dir):
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
    with patch("infra.parquet.query_since", return_value=[_row(ts)]):
        with patch("infra.parquet.write_notification"):
            _mod.run_etl("wm-1", db=None)
    _mod.delete_file("wm-1")
    assert _mod.file_exists("wm-1") is False


def test_list_files_returns_metadata(parquet_dir):
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
    with patch("infra.parquet.query_since", return_value=[_row(ts)]):
        with patch("infra.parquet.write_notification"):
            _mod.run_etl("wm-1", db=None)
    files = _mod.list_files(set())
    assert len(files) == 1
    assert files[0]["windmill_id"] == "wm-1"
    assert files[0]["in_use"] is False


def test_list_files_marks_running_windmills(parquet_dir):
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
    with patch("infra.parquet.query_since", return_value=[_row(ts)]):
        with patch("infra.parquet.write_notification"):
            _mod.run_etl("wm-1", db=None)
    files = _mod.list_files({"wm-1"})
    assert files[0]["in_use"] is True


def test_list_files_empty_when_no_directory(parquet_dir):
    import shutil
    shutil.rmtree(str(parquet_dir))
    _mod._PARQUET_DATA_PATH = str(parquet_dir)
    assert _mod.list_files(set()) == []
