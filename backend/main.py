"""FastAPI application entry point."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from infra.db import SessionLocal
from infra import windmill_repo
from routers import farms, windmills, parquet, notifications, websocket, sse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: reset is_running flags, ensure data directories exist."""
    # Ensure data directories exist
    parquet_path = os.getenv("PARQUET_DATA_PATH", "./data/parquet")
    log_path = os.getenv("LOG_FILE_PATH", "./data/notifications.jsonl")
    os.makedirs(parquet_path, exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)

    # Reset all is_running flags (in-process tasks do not survive restarts)
    db = SessionLocal()
    try:
        windmill_repo.reset_all_running(db)
    finally:
        db.close()

    yield
    # Shutdown: nothing to clean up (tasks will be cancelled by Python)


app = FastAPI(
    title="Windmill Scanner API",
    description="Simulates sensor data from windmills organized into farms.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(farms.router)
app.include_router(windmills.router)
app.include_router(parquet.router)
app.include_router(notifications.router)
app.include_router(websocket.router)
app.include_router(sse.router)
