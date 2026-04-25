"""Add anomaly columns to sensor_readings

Revision ID: 002
Revises: 001
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sensor_readings", sa.Column("potential_anomaly", sa.Boolean(), nullable=True))
    op.add_column("sensor_readings", sa.Column("anomaly_probability", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("sensor_readings", "anomaly_probability")
    op.drop_column("sensor_readings", "potential_anomaly")
