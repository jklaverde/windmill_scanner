"""Sensor value generation: mean-reverting bounded random walk within the normal range."""
import random
from dataclasses import dataclass


@dataclass
class SensorConfig:
    clamp_min: float   # UI floor constraint — not used in simulation math
    normal_min: float  # simulation lower bound
    normal_max: float  # simulation upper bound
    spike_max: float   # UI ceiling constraint — not used in simulation math
    rate: float        # max delta as percent of normal_range (0.0–10.0)


def initial_seed(config: SensorConfig) -> float:
    """Return a random starting value within the normal range."""
    return random.uniform(config.normal_min, config.normal_max)


_REVERSION_STRENGTH = 0.10  # 10% of the gap to midpoint closed each step


def generate_value(current: float, config: SensorConfig) -> float:
    """
    Produce the next sensor value using a mean-reverting random walk.

    Delta: ± (rate% × normal_range), randomly drawn each beat.
    Reversion: 10% pull toward the midpoint to prevent drift to the boundaries.
    Result is clamped to [normal_min, normal_max].

    clamp_min and spike_max are UI-only constraints and play no part here.
    """
    normal_range = config.normal_max - config.normal_min
    midpoint = (config.normal_min + config.normal_max) / 2.0

    max_delta = (config.rate / 100.0) * normal_range
    delta = random.uniform(-max_delta, max_delta)
    reversion = _REVERSION_STRENGTH * (midpoint - current)
    value = current + delta + reversion

    return max(config.normal_min, min(config.normal_max, value))


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
