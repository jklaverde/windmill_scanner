"""Tests for the pure sensor simulation functions."""
import pytest
from unittest.mock import patch, call

from domain.simulation import SensorConfig, initial_seed, generate_value, configs_from_windmill

_CFG = SensorConfig(clamp_min=0.0, normal_min=20.0, normal_max=50.0, spike_max=200.0, rate=2.0)


# ── initial_seed ──────────────────────────────────────────────────────────────

def test_initial_seed_is_within_normal_range():
    for _ in range(300):
        result = initial_seed(_CFG)
        assert _CFG.normal_min <= result <= _CFG.normal_max


def test_initial_seed_uses_normal_bounds():
    with patch("domain.simulation.random.uniform", return_value=28.0) as mock_u:
        result = initial_seed(_CFG)
    assert result == pytest.approx(28.0)
    mock_u.assert_called_once_with(_CFG.normal_min, _CFG.normal_max)


def test_initial_seed_arbitrary_range():
    cfg = SensorConfig(clamp_min=0.0, normal_min=10.0, normal_max=30.0, spike_max=100.0, rate=1.0)
    for _ in range(100):
        result = initial_seed(cfg)
        assert cfg.normal_min <= result <= cfg.normal_max


# ── generate_value bounds ─────────────────────────────────────────────────────

def test_generate_value_never_below_normal_min():
    for _ in range(500):
        result = generate_value(initial_seed(_CFG), _CFG)
        assert result >= _CFG.normal_min


def test_generate_value_never_exceeds_normal_max():
    for _ in range(500):
        result = generate_value(initial_seed(_CFG), _CFG)
        assert result <= _CFG.normal_max


def test_generate_value_clamp_min_and_spike_max_not_used():
    # Even with extreme clamp_min/spike_max values, output stays within normal range.
    cfg = SensorConfig(clamp_min=-999.0, normal_min=20.0, normal_max=50.0, spike_max=9999.0, rate=2.0)
    for _ in range(200):
        result = generate_value(initial_seed(cfg), cfg)
        assert cfg.normal_min <= result <= cfg.normal_max


# ── generate_value zero-delta at midpoint ─────────────────────────────────────

def test_generate_value_zero_delta_at_midpoint():
    # At midpoint reversion=0, delta=0 → value unchanged.
    midpoint = (_CFG.normal_min + _CFG.normal_max) / 2.0  # 35.0
    with patch("domain.simulation.random.uniform", return_value=0.0):
        result = generate_value(midpoint, _CFG)
    assert result == pytest.approx(midpoint)


# ── generate_value mean reversion ─────────────────────────────────────────────

def test_generate_value_reverts_toward_midpoint_when_above():
    # current near top of normal range → reversion pulls downward with zero delta.
    current = 48.0  # above midpoint (35.0)
    with patch("domain.simulation.random.uniform", return_value=0.0):
        result = generate_value(current, _CFG)
    # reversion = 0.1 * (35 - 48) = -1.3 → value = 46.7
    assert result < current


def test_generate_value_reverts_toward_midpoint_when_below():
    current = 22.0  # below midpoint (35.0)
    with patch("domain.simulation.random.uniform", return_value=0.0):
        result = generate_value(current, _CFG)
    # reversion = 0.1 * (35 - 22) = 1.3 → value = 23.3
    assert result > current


# ── generate_value clamping ───────────────────────────────────────────────────

def test_generate_value_clamped_to_normal_min():
    # current below normal_min → output clamped up to normal_min.
    cfg = SensorConfig(clamp_min=-999.0, normal_min=10.0, normal_max=20.0, spike_max=999.0, rate=0.0)
    with patch("domain.simulation.random.uniform", return_value=0.0):
        # rate=0 → delta=0; reversion=0.1*(15-0)=1.5; value=1.5 → clamped to 10.0
        result = generate_value(0.0, cfg)
    assert result == pytest.approx(cfg.normal_min)


def test_generate_value_clamped_to_normal_max():
    # current above normal_max → output clamped down to normal_max.
    cfg = SensorConfig(clamp_min=-999.0, normal_min=10.0, normal_max=20.0, spike_max=999.0, rate=0.0)
    with patch("domain.simulation.random.uniform", return_value=0.0):
        # rate=0 → delta=0; reversion=0.1*(15-100)=-8.5; value=91.5 → clamped to 20.0
        result = generate_value(100.0, cfg)
    assert result == pytest.approx(cfg.normal_max)


# ── configs_from_windmill ─────────────────────────────────────────────────────

def test_configs_from_windmill_returns_four_sensors():
    class FakeWindmill:
        temp_clamp_min = 0.0;  temp_normal_min = 20.0;  temp_normal_max = 50.0;  temp_spike_max = 200.0;  temp_rate = 2.0
        noise_clamp_min = 0.0; noise_normal_min = 5.0;  noise_normal_max = 60.0; noise_spike_max = 180.0; noise_rate = 2.0
        humidity_clamp_min = 0.0; humidity_normal_min = 10.0; humidity_normal_max = 90.0; humidity_spike_max = 99.0; humidity_rate = 2.0
        wind_clamp_min = 0.0;  wind_normal_min = 2.0;   wind_normal_max = 45.0;  wind_spike_max = 200.0;  wind_rate = 2.0

    configs = configs_from_windmill(FakeWindmill())
    assert set(configs.keys()) == {"temperature", "noise_level", "humidity", "wind_speed"}


def test_configs_from_windmill_values_match():
    class FakeWindmill:
        temp_clamp_min = 1.0;  temp_normal_min = 21.0; temp_normal_max = 51.0; temp_spike_max = 201.0; temp_rate = 3.0
        noise_clamp_min = 0.0; noise_normal_min = 5.0;  noise_normal_max = 60.0; noise_spike_max = 180.0; noise_rate = 2.0
        humidity_clamp_min = 0.0; humidity_normal_min = 10.0; humidity_normal_max = 90.0; humidity_spike_max = 99.0; humidity_rate = 2.0
        wind_clamp_min = 0.0;  wind_normal_min = 2.0;  wind_normal_max = 45.0;  wind_spike_max = 200.0;  wind_rate = 2.0

    configs = configs_from_windmill(FakeWindmill())
    assert configs["temperature"].clamp_min == 1.0
    assert configs["temperature"].normal_min == 21.0
    assert configs["temperature"].spike_max == 201.0
    assert configs["temperature"].rate == 3.0
