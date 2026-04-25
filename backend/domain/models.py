from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, CHAR, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True)
    name = Column(String(60), unique=True, nullable=False)
    description = Column(String(100), nullable=False, server_default="")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Windmill(Base):
    __tablename__ = "windmills"

    id = Column(Integer, primary_key=True)
    windmill_id = Column(String(32), unique=True, nullable=False)
    name = Column(String(60), nullable=False, server_default="")
    description = Column(String(100), nullable=False, server_default="")
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="RESTRICT"), nullable=False)
    is_running = Column(Boolean, nullable=False, default=False, server_default="false")
    sensor_beat = Column(Integer, nullable=False, server_default="5")
    sensor_beat_unit = Column(String(2), nullable=False, server_default="ss")
    location_beat = Column(Integer, nullable=False, server_default="1")
    location_beat_unit = Column(String(2), nullable=False, server_default="dd")
    lat = Column(Float, nullable=False, server_default="0.0")
    lat_dir = Column(CHAR(1), nullable=False, server_default="N")
    lon = Column(Float, nullable=False, server_default="0.0")
    lon_dir = Column(CHAR(1), nullable=False, server_default="E")
    # Temperature range
    temp_clamp_min = Column(Float, nullable=False, server_default="0")
    temp_normal_min = Column(Float, nullable=False, server_default="20")
    temp_normal_max = Column(Float, nullable=False, server_default="50")
    temp_spike_max = Column(Float, nullable=False, server_default="200")
    # Noise level range
    noise_clamp_min = Column(Float, nullable=False, server_default="0")
    noise_normal_min = Column(Float, nullable=False, server_default="5")
    noise_normal_max = Column(Float, nullable=False, server_default="60")
    noise_spike_max = Column(Float, nullable=False, server_default="180")
    # Humidity range
    humidity_clamp_min = Column(Float, nullable=False, server_default="0")
    humidity_normal_min = Column(Float, nullable=False, server_default="10")
    humidity_normal_max = Column(Float, nullable=False, server_default="90")
    humidity_spike_max = Column(Float, nullable=False, server_default="99")
    # Wind speed range
    wind_clamp_min = Column(Float, nullable=False, server_default="0")
    wind_normal_min = Column(Float, nullable=False, server_default="2")
    wind_normal_max = Column(Float, nullable=False, server_default="45")
    wind_spike_max = Column(Float, nullable=False, server_default="200")
    # Rate-of-variation (0.0–10.0%)
    temp_rate = Column(Float, nullable=False, server_default="2.0")
    noise_rate = Column(Float, nullable=False, server_default="2.0")
    humidity_rate = Column(Float, nullable=False, server_default="2.0")
    wind_rate = Column(Float, nullable=False, server_default="2.0")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True)
    windmill_id = Column(String(32), nullable=False, index=True)
    measurement_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    db_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    temperature = Column(Float, nullable=False)
    noise_level = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    wind_speed = Column(Float, nullable=False)
    potential_anomaly = Column(Boolean, nullable=True)
    anomaly_probability = Column(Float, nullable=True)


class LocationHeartbeat(Base):
    __tablename__ = "location_heartbeats"

    id = Column(Integer, primary_key=True)
    windmill_id = Column(String(32), nullable=False)
    measurement_timestamp = Column(DateTime(timezone=True), nullable=False)
    db_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    lat = Column(Float, nullable=False)
    lat_dir = Column(CHAR(1), nullable=False)
    lon = Column(Float, nullable=False)
    lon_dir = Column(CHAR(1), nullable=False)
