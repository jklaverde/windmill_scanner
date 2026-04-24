"""Sensor value generation algorithm: bounded random walk with spike injection."""
import random
from dataclasses import dataclass


@dataclass
class SensorConfig:
    """Per-sensor range and rate configuration."""
    clamp_min: float
    normal_min: float
    normal_max: float
    spike_max: float
    rate: float  # max delta as percent of normal_range (0.0–10.0)


def initial_seed(config: SensorConfig) -> float:
    """Return the midpoint of the normal range as the starting value."""
    return (config.normal_min + config.normal_max) / 2.0


def generate_value(current: float, config: SensorConfig) -> float:
    """
    Produce the next sensor value using a bounded random walk.

    ~5% chance of spike injection near spike_max.
    Otherwise: apply random delta in [-rate% * normal_range, +rate% * normal_range].
    Result is always clamped to [clamp_min, spike_max].
    """
    normal_range = config.normal_max - config.normal_min

    if random.random() < 0.05:
        # Spike: jump near spike_max ± 10% of normal_range
        deviation = 0.1 * normal_range
        value = config.spike_max + random.uniform(-deviation, deviation)
    else:
        max_delta = (config.rate / 100.0) * normal_range
        delta = random.uniform(-max_delta, max_delta)
        value = current + delta

    return max(config.clamp_min, min(config.spike_max, value))


def configs_from_windmill(wm) -> dict[str, SensorConfig]:
    """Build a SensorConfig dict from a Windmill ORM instance."""
    return {
        "temperature": SensorConfig(
            wm.temp_clamp_min, wm.temp_normal_min, wm.temp_normal_max, wm.temp_spike_max, wm.temp_rate
        ),
        "noise_level": SensorConfig(
            wm.noise_clamp_min, wm.noise_normal_min, wm.noise_normal_max, wm.noise_spike_max, wm.noise_rate
        ),
        "humidity": SensorConfig(
            wm.humidity_clamp_min, wm.humidity_normal_min, wm.humidity_normal_max, wm.humidity_spike_max, wm.humidity_rate
        ),
        "wind_speed": SensorConfig(
            wm.wind_clamp_min, wm.wind_normal_min, wm.wind_normal_max, wm.wind_spike_max, wm.wind_rate
        ),
    }
