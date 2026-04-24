"""Initial schema: farms, windmills, sensor_readings, location_heartbeats

Revision ID: 001
Revises:
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "farms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(60), unique=True, nullable=False),
        sa.Column("description", sa.String(100), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "windmills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("windmill_id", sa.String(32), unique=True, nullable=False),
        sa.Column("name", sa.String(60), nullable=False, server_default=""),
        sa.Column("description", sa.String(100), nullable=False, server_default=""),
        sa.Column(
            "farm_id",
            sa.Integer(),
            sa.ForeignKey("farms.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("is_running", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sensor_beat", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("sensor_beat_unit", sa.String(2), nullable=False, server_default="ss"),
        sa.Column("location_beat", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("location_beat_unit", sa.String(2), nullable=False, server_default="dd"),
        sa.Column("lat", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lat_dir", sa.CHAR(1), nullable=False, server_default="N"),
        sa.Column("lon", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("lon_dir", sa.CHAR(1), nullable=False, server_default="E"),
        # Temperature
        sa.Column("temp_clamp_min", sa.Float(), nullable=False, server_default="0"),
        sa.Column("temp_normal_min", sa.Float(), nullable=False, server_default="20"),
        sa.Column("temp_normal_max", sa.Float(), nullable=False, server_default="50"),
        sa.Column("temp_spike_max", sa.Float(), nullable=False, server_default="200"),
        # Noise level
        sa.Column("noise_clamp_min", sa.Float(), nullable=False, server_default="0"),
        sa.Column("noise_normal_min", sa.Float(), nullable=False, server_default="5"),
        sa.Column("noise_normal_max", sa.Float(), nullable=False, server_default="60"),
        sa.Column("noise_spike_max", sa.Float(), nullable=False, server_default="180"),
        # Humidity
        sa.Column("humidity_clamp_min", sa.Float(), nullable=False, server_default="0"),
        sa.Column("humidity_normal_min", sa.Float(), nullable=False, server_default="10"),
        sa.Column("humidity_normal_max", sa.Float(), nullable=False, server_default="90"),
        sa.Column("humidity_spike_max", sa.Float(), nullable=False, server_default="99"),
        # Wind speed
        sa.Column("wind_clamp_min", sa.Float(), nullable=False, server_default="0"),
        sa.Column("wind_normal_min", sa.Float(), nullable=False, server_default="2"),
        sa.Column("wind_normal_max", sa.Float(), nullable=False, server_default="45"),
        sa.Column("wind_spike_max", sa.Float(), nullable=False, server_default="200"),
        # Rate-of-variation
        sa.Column("temp_rate", sa.Float(), nullable=False, server_default="2.0"),
        sa.Column("noise_rate", sa.Float(), nullable=False, server_default="2.0"),
        sa.Column("humidity_rate", sa.Float(), nullable=False, server_default="2.0"),
        sa.Column("wind_rate", sa.Float(), nullable=False, server_default="2.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("windmill_id", sa.String(32), nullable=False),
        sa.Column("measurement_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "db_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("temperature", sa.Float(), nullable=False),
        sa.Column("noise_level", sa.Float(), nullable=False),
        sa.Column("humidity", sa.Float(), nullable=False),
        sa.Column("wind_speed", sa.Float(), nullable=False),
    )
    op.create_index("ix_sensor_readings_windmill_id", "sensor_readings", ["windmill_id"])
    op.create_index(
        "ix_sensor_readings_measurement_timestamp",
        "sensor_readings",
        ["measurement_timestamp"],
    )

    op.create_table(
        "location_heartbeats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("windmill_id", sa.String(32), nullable=False),
        sa.Column("measurement_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "db_timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lat_dir", sa.CHAR(1), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("lon_dir", sa.CHAR(1), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("location_heartbeats")
    op.drop_index("ix_sensor_readings_measurement_timestamp", "sensor_readings")
    op.drop_index("ix_sensor_readings_windmill_id", "sensor_readings")
    op.drop_table("sensor_readings")
    op.drop_table("windmills")
    op.drop_table("farms")
