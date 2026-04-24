"""
Shared test fixtures.

Environment variables must be set before any app module is imported,
because infra/db.py and infra/notifications.py read them at module level.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("LOG_FILE_PATH", "./tests/test_notifications.jsonl")
os.environ.setdefault("PARQUET_DATA_PATH", "./tests/test_parquet")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from domain.models import Base
import infra.db as _db_module

# In-memory SQLite with StaticPool so every session shares one connection.
_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

# Patch the app's database module before main.py is imported.
_db_module.engine = _engine
_db_module.SessionLocal = _Session

Base.metadata.create_all(bind=_engine)

from infra.db import get_db  # noqa: E402
from main import app  # noqa: E402


def _override_get_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def clean_tables():
    """Delete all rows between tests for isolation."""
    yield
    with _engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
