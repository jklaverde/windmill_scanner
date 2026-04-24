# Windmill Data Stream Simulator

> **Course project** — DLBDSMTP01: From Model to Production  
> Big Data Masterclass · IU Internationale Hochschule  
> Developed by Juan Carlos Laverde (UPS10797707) · Academic Year 2025–2026

A real-time simulator for wind turbine sensor data streams. The application supports the creation and management of wind turbine farms and parks, generating continuous multi-sensor readings — temperature, noise level, relative humidity, and wind speed — to facilitate the monitoring, archival, and early detection of potential equipment anomalies.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start — Docker (Recommended)](#quick-start--docker-recommended)
5. [Configuration](#configuration)
6. [Optional: PostgreSQL Deployment](#optional-postgresql-deployment)
7. [Local Development Setup](#local-development-setup)
8. [Running the Tests](#running-the-tests)
9. [Using the Application](#using-the-application)
10. [Simulation Algorithm](#simulation-algorithm)
11. [Data Storage & ETL](#data-storage--etl)
12. [Project Structure](#project-structure)
13. [API Reference](#api-reference)

---

## Overview

The simulator allows users to:

- Create and manage **wind turbine farms** (groups of windmills)
- Define individual **windmills** with configurable sensor ranges and sampling rates
- Start and stop **real-time sensor simulation** per windmill
- Visualise live sensor values in a **real-time signals chart**
- Browse historical data in a **history chart** across minute, hour, day, and week scales
- Archive sensor readings from the database to **Parquet files** via an ETL pipeline
- Receive **system notifications** via Server-Sent Events

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Docker Container                  │
│                                                     │
│  ┌──────────┐     ┌───────────────────────────────┐ │
│  │  Nginx   │────▶│  FastAPI  (Uvicorn :8000)     │ │
│  │  :80     │     │  REST · WebSocket · SSE        │ │
│  │  (static │     └────────────┬──────────────────┘ │
│  │  + proxy)│                  │                     │
│  └──────────┘          ┌───────┴───────┐             │
│                        │   SQLite DB   │             │
│                        │  (or Postgres)│             │
│                        └───────────────┘             │
│                                                     │
│  /app/data/  ──  SQLite file · Parquet files · logs │
└─────────────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts, Zustand, TanStack Query |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, Alembic, Uvicorn |
| Real-time | WebSockets (sensor stream), Server-Sent Events (notifications) |
| Database | SQLite (default, embedded) · PostgreSQL (optional) |
| Data archive | Apache Parquet via pandas + pyarrow |
| Deployment | Single Docker image — Nginx + Uvicorn managed by Supervisord |

---

## Prerequisites

### For Docker deployment (recommended)

| Tool | Minimum version | Install |
|---|---|---|
| Docker Engine | 24 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 (included with Docker Desktop) | bundled |

### For local development

| Tool | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 20 |
| npm | 9 |

---

## Quick Start — Docker (Recommended)

This is the **fastest path** to a fully functional instance with zero external dependencies. The application runs in a single container using an embedded SQLite database.

### Step 1 — Clone the repository

```bash
git clone <repository-url>
cd windmill_scanner
```

### Step 2 — Create the environment file

```bash
cp .env.example .env
```

The default `.env` activates SQLite mode — no further changes are required for a first run.

### Step 3 — Build and start

```bash
docker compose up --build
```

The first build downloads base images and installs all dependencies; subsequent builds are cached and faster.

### Step 4 — Open the application

Navigate to **http://localhost** in any browser.

> The database schema is created automatically on first start via Alembic migrations. No manual database setup is required.

### Stopping the application

```bash
docker compose down
```

Data persists in the `windmill_data` Docker volume. To remove all data alongside the container:

```bash
docker compose down -v
```

---

## Configuration

All runtime configuration is controlled through the `.env` file in the project root.

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Default: SQLite — no external service required.
# To use PostgreSQL, uncomment and fill in the line below:
# DATABASE_URL=postgresql://username:password@host:5432/database_name

# ── Data paths ────────────────────────────────────────────────────────────────
PARQUET_DATA_PATH=/app/data/parquet
LOG_FILE_PATH=/app/data/notifications.jsonl

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS=*
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | SQLite at `/app/data/windmill_scanner.db` | Full database connection string |
| `PARQUET_DATA_PATH` | `/app/data/parquet` | Directory for Parquet archive files |
| `LOG_FILE_PATH` | `/app/data/notifications.jsonl` | Persistent notification log |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins for the API |

---

## Optional: PostgreSQL Deployment

Use this path when an existing PostgreSQL server is available and persistence beyond Docker volumes is required.

### Step 1 — Create the database on the PostgreSQL server

```sql
CREATE DATABASE windmill_scanner;
CREATE USER windmill_role WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE windmill_scanner TO windmill_role;
```

### Step 2 — Configure `.env`

```env
DATABASE_URL=postgresql://windmill_role:your_password@your_host:5432/windmill_scanner
```

### Step 3 — Build and start

```bash
docker compose up --build
```

Alembic runs automatically on startup and creates all tables. No additional migration steps are needed.

---

## Local Development Setup

Use this path to run the backend and frontend separately with live reload.

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux / macOS
.venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt

# Configure the environment
cp .env.example .env             # or create backend/.env manually
# Edit .env — set DATABASE_URL if using PostgreSQL; SQLite is used by default

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at **http://localhost:8000**.  
Interactive API documentation: **http://localhost:8000/docs**

### Frontend

In a separate terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend is available at **http://localhost:5173** and proxies API calls to the backend at `http://localhost:8000` by default.

---

## Running the Tests

### Backend tests

```bash
cd backend
source .venv/bin/activate

pytest tests/ -v
```

The test suite uses an in-memory SQLite database and does not require a running server or any external services. All 82 tests should pass.

### Frontend tests

```bash
cd frontend
npm test
```

---

## Using the Application

### 1 — Create a farm

Click **New Farm** in the Farm Management panel (left). Enter a name and description. The farm appears in the list immediately.

### 2 — Create a windmill

Select the farm, then click **New Windmill** in the Windmill Management panel (centre). Configure:

| Field | Description |
|---|---|
| Windmill ID | Unique identifier, alphanumeric and underscores (`Turbine_01`) |
| Name / Description | Human-readable labels |
| Sensor Beat | How often sensor readings are generated (e.g. every 5 seconds) |
| Location Beat | How often the GPS heartbeat is recorded (e.g. every 1 day) |
| Latitude / Longitude | Geographic position |
| Sensor ranges | **Sim Min** and **Sim Max** define the normal operating range for each sensor; **Floor** and **Ceiling** constrain the editable bounds in the form |
| Rate slider | Maximum percentage change per beat (0–10 %) |

### 3 — Start the simulation

Select a windmill and click **Start**. The real-time signals chart (bottom-left) begins plotting live readings. The status badge changes to **running**.

Use **Start All** / **Stop All** on the Farm panel to control every windmill in a farm at once.

### 4 — View history

Select a windmill to populate the History chart (bottom-right). Use the **minute / hour / day / week** tabs to change the time window.

### 5 — Archive data (ETL)

Click **ETL** on a selected windmill to transfer its sensor readings from the database to a Parquet file. The Parquet Files panel (right) lists all archives with their size and data time range. Click **Farm ETL** in the Windmill Management header to archive all windmills in the current farm at once.

### 6 — Edit a windmill

Click **Edit** while a windmill is selected. If the windmill is running, the simulation is paused automatically and restarted when you save or cancel.

---

## Simulation Algorithm

Each windmill runs an independent asynchronous task that generates sensor values at the configured interval.

**Initial value:** A random number drawn uniformly from `[Sim Min, Sim Max]`.

**Subsequent values** follow a mean-reverting bounded random walk:

```
delta     = uniform(−max_delta, +max_delta)   where max_delta = (rate / 100) × (Sim Max − Sim Min)
reversion = 0.10 × (midpoint − current)
next      = clamp(current + delta + reversion, Sim Min, Sim Max)
```

The reversion term (10 % of the distance to the midpoint, applied each beat) prevents the value from drifting and bouncing persistently at the boundaries. The Floor and Ceiling fields are UI-only constraints that define the editable range for Sim Min and Sim Max; they play no part in the simulation calculation.

---

## Data Storage & ETL

| Store | Purpose |
|---|---|
| SQLite / PostgreSQL | Live sensor readings and location heartbeats (hot storage) |
| Parquet files | Long-term archive (cold storage), written by the ETL pipeline |
| `notifications.jsonl` | Persistent notification log, loaded on startup |

The ETL pipeline is **incremental**: it reads only rows newer than the latest timestamp already present in the Parquet file, appends them, and overwrites the file atomically. Running ETL repeatedly on the same windmill is safe.

---

## Project Structure

```
windmill_scanner/
├── Dockerfile                  # Single-image multi-stage build
├── docker-compose.yml          # Single-container deployment (SQLite default)
├── docker-compose.prod.yml     # Multi-container deployment (external PostgreSQL)
├── .env.example                # Configuration template — copy to .env
├── deploy/
│   ├── nginx.conf              # Nginx: static files + API proxy
│   ├── supervisord.conf        # Process manager: Nginx + Uvicorn
│   └── entrypoint.sh           # Container startup: migrations → supervisor
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── domain/
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   └── simulation.py       # Sensor value generation algorithm
│   ├── infra/
│   │   ├── db.py               # Database engine and session factory
│   │   ├── parquet.py          # ETL pipeline and history reader
│   │   ├── sensor_repo.py      # Sensor readings repository
│   │   ├── windmill_repo.py    # Windmill repository
│   │   ├── notifications.py    # Notification log writer
│   │   └── task_registry.py    # In-process simulation task tracker
│   ├── routers/
│   │   ├── farms.py            # Farm CRUD + start/stop all + ETL
│   │   ├── windmills.py        # Windmill CRUD + start/stop + history
│   │   ├── parquet.py          # Parquet file manager
│   │   ├── notifications.py    # Notification list endpoint
│   │   ├── websocket.py        # WebSocket sensor stream
│   │   ├── sse.py              # Server-Sent Events notification stream
│   │   └── simulation.py       # Async simulation loop tasks
│   ├── alembic/                # Database migration scripts
│   └── tests/                  # Backend test suite (82 tests)
└── frontend/
    └── src/
        ├── App.tsx             # Root layout and WebSocket/SSE lifecycle
        ├── store/useStore.ts   # Zustand global state
        ├── domain/types.ts     # Shared TypeScript types
        ├── infra/
        │   ├── api.ts          # Axios instance + WS base URL helper
        │   ├── ws.ts           # WebSocket client with backoff retry
        │   └── sse.ts          # SSE client
        └── components/
            ├── FarmPanel.tsx
            ├── WindmillPanel.tsx
            ├── ParquetPanel.tsx
            ├── SignalsChart.tsx
            ├── HistoryChart.tsx
            ├── NotificationsPanel.tsx
            ├── CreateWindmillForm.tsx
            ├── EditWindmillForm.tsx
            ├── AboutModal.tsx
            └── ConfirmDialog.tsx
```

---

## API Reference

The full interactive API documentation is available at **http://localhost:8000/docs** when running locally, or **http://localhost/docs** when running via Docker.

| Method | Path | Description |
|---|---|---|
| `GET` | `/farms` | List all farms |
| `POST` | `/farms` | Create a farm |
| `DELETE` | `/farms/{id}` | Delete a farm |
| `POST` | `/farms/{id}/start` | Start all windmills in a farm |
| `POST` | `/farms/{id}/stop` | Stop all windmills in a farm |
| `POST` | `/farms/{id}/etl` | Run ETL for all windmills in a farm |
| `GET` | `/farms/{id}/windmills` | List windmills in a farm |
| `POST` | `/windmills` | Create a windmill |
| `GET` | `/windmills/{id}` | Get windmill details |
| `PUT` | `/windmills/{id}` | Update windmill configuration |
| `DELETE` | `/windmills/{id}` | Delete a windmill |
| `POST` | `/windmills/{id}/start` | Start simulation |
| `POST` | `/windmills/{id}/stop` | Stop simulation |
| `GET` | `/windmills/{id}/history` | Get archived sensor history |
| `POST` | `/windmills/{id}/etl` | Run ETL for a windmill |
| `GET` | `/parquet-files` | List Parquet archive files |
| `DELETE` | `/parquet-files/{id}` | Delete a Parquet file |
| `GET` | `/notifications` | List recent notifications |
| `GET` | `/notifications/stream` | SSE notification stream |
| `WS` | `/ws/{windmill_id}` | WebSocket sensor data stream |

---

*Rights Notice: The author donates all rights over this work to IU Internationale Hochschule for any academic purpose the institution considers appropriate. The source code may be used, adapted, or redistributed freely for academic and educational purposes.*
