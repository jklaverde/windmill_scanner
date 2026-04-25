# Windmill Data Stream Simulator

> **Course project** — DLBDSMTP01: From Model to Production  
> Big Data Masterclass · IU Internationale Hochschule  
> Developed by Juan Carlos Laverde (UPS10797707) · Academic Year 2025–2026

A real-time simulator for wind turbine sensor data streams. The application supports the creation and management of wind turbine farms, generates continuous multi-sensor readings — temperature, noise level, relative humidity, and wind speed — and integrates a machine-learning anomaly detection service to predict the probability of mechanical or thermal failures in real time.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start — Docker (Recommended)](#quick-start--docker-recommended)
5. [Configuration](#configuration)
6. [Local Development Setup](#local-development-setup)
7. [Running the Tests](#running-the-tests)
8. [Using the Application](#using-the-application)
9. [Anomaly Detection](#anomaly-detection)
10. [Simulation Algorithm](#simulation-algorithm)
11. [Data Storage & ETL](#data-storage--etl)
12. [Project Structure](#project-structure)
13. [API Reference](#api-reference)

---

## Overview

The simulator allows users to:

- Create and manage **wind turbine farms** (groups of windmills)
- Define individual **windmills** with configurable sensor ranges and sampling rates
- Start and stop **real-time sensor simulation** per windmill or per farm
- Visualise live sensor values in a **real-time signals chart** with anomaly highlighting
- Browse historical data in a **history chart** across minute, hour, day, and week scales, with anomaly markers overlaid
- Archive sensor readings from the database to **Parquet files** via an incremental ETL pipeline
- Detect potential failures through a **machine-learning anomaly detection service** integrated into every sensor reading
- Receive **system notifications** in real time via Server-Sent Events

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     docker-compose.prod.yml                     │
│                                                                 │
│  ┌──────────┐    ┌─────────────────────┐    ┌────────────────┐ │
│  │  Nginx   │───▶│  FastAPI  :8000     │───▶│  PostgreSQL    │ │
│  │  :80     │    │  REST · WS · SSE    │    │  :5432         │ │
│  │  static  │    │                     │    └────────────────┘ │
│  │  + proxy │    │  ┌───────────────┐  │                       │
│  └──────────┘    │  │ Parquet files │  │    ┌────────────────┐ │
│                  │  │ Notif. log    │  │───▶│ Wind Turbine   │ │
│                  │  └───────────────┘  │    │ Assessment API │ │
│                  └─────────────────────┘    │ :8001 (ML)     │ │
│                                             └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite, Tailwind CSS, Recharts, Zustand, TanStack Query |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic, Uvicorn |
| ML Service | Python 3.11, FastAPI — Wind Turbine Assessment API (sibling project) |
| Real-time | WebSockets (sensor stream), Server-Sent Events (notifications) |
| Database | PostgreSQL 16 |
| Data archive | Apache Parquet via pandas + pyarrow |
| Deployment | Docker Compose — four services: nginx, backend, PostgreSQL, ML service |

---

## Prerequisites

### For Docker deployment (recommended)

| Tool | Minimum version | Notes |
|---|---|---|
| Docker Engine | 24 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 | Bundled with Docker Desktop |

Both projects must be cloned as siblings in the same parent directory:

```
FromModelToProduction/
├── windmill_scanner/         ← this project
└── wind_turbine_assessment/  ← ML service (required)
```

The `docker-compose.prod.yml` builds the ML service from `../wind_turbine_assessment` at compose build time.

### For local development

| Tool | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 20 |
| npm | 9 |
| PostgreSQL | 16 |

---

## Quick Start — Docker (Recommended)

This is the fastest path to a fully functional instance. All four services — frontend, backend, database, and ML anomaly detection — start with a single command.

> **Note:** The ML service trains its model during the Docker image build. The first build may take several minutes depending on your machine. Subsequent builds use Docker's layer cache and are fast.

### Step 1 — Clone both repositories as siblings

```bash
git clone <windmill-scanner-repo-url> windmill_scanner
git clone <wind-turbine-assessment-repo-url> wind_turbine_assessment
```

Both directories must sit in the same parent folder.

### Step 2 — Enter the windmill_scanner directory

```bash
cd windmill_scanner
```

### Step 3 — Create the backend environment file

```bash
cp backend/.env.example backend/.env
```

The defaults in `.env.example` work out of the box for Docker deployment. No edits are required for a first run.

### Step 4 — Build and start all services

```bash
docker compose -f docker-compose.prod.yml up --build
```

### Step 5 — Open the application

Navigate to **http://localhost** in any browser.

> Alembic database migrations run automatically before the backend starts. No manual database setup is required.

### Stopping the application

```bash
docker compose -f docker-compose.prod.yml down
```

Data persists in Docker volumes. To remove all data alongside the containers:

```bash
docker compose -f docker-compose.prod.yml down -v
```

---

## Configuration

All runtime configuration for the backend is controlled through `backend/.env`.

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@db:5432/windmill_scanner

# ── Data paths ────────────────────────────────────────────────────────────────
PARQUET_DATA_PATH=./data/parquet
LOG_FILE_PATH=./data/notifications.jsonl

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:5173

# ── ML Anomaly Detection service ──────────────────────────────────────────────
ANOMALY_SERVICE_URL=http://localhost:8001
```

| Variable | Default (dev) | Docker prod value | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://...@localhost:5432/windmill_scanner` | `postgresql://...@db:5432/windmill_scanner` | PostgreSQL connection string |
| `PARQUET_DATA_PATH` | `./data/parquet` | `/app/data/parquet` | Directory for Parquet archive files |
| `LOG_FILE_PATH` | `./data/notifications.jsonl` | `/app/data/notifications.jsonl` | Persistent notification log |
| `CORS_ORIGINS` | `http://localhost:5173` | `http://localhost` | Comma-separated allowed origins |
| `ANOMALY_SERVICE_URL` | `http://localhost:8001` | `http://wind-turbine-assessment:8001` | Base URL of the ML anomaly detection service |

The frontend uses a single variable configured in `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

This drives both REST calls and the WebSocket connection. No separate variable is needed for WebSockets.

---

## Local Development Setup

Use this path to run each service separately with live reload.

### Step 1 — Start the ML service

The anomaly detection service must be running before the backend starts. In the `wind_turbine_assessment` directory:

```bash
cd ../wind_turbine_assessment

python -m venv .venv
source .venv/bin/activate      # Linux / macOS
.venv\Scripts\activate         # Windows

pip install -r requirements.txt
python pipeline.py             # trains the model (runs once)
uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --reload
```

The ML service is available at **http://localhost:8001**.  
Interactive docs: **http://localhost:8001/docs**

### Step 2 — Start PostgreSQL

Use the provided Docker Compose file to spin up a local PostgreSQL instance:

```bash
cd windmill_scanner
docker compose up -d           # starts only the PostgreSQL container
```

Or use any existing PostgreSQL 16 instance and set `DATABASE_URL` accordingly.

### Step 3 — Start the backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate      # Linux / macOS
.venv\Scripts\activate         # Windows

pip install -r requirements.txt

cp .env.example .env           # then edit .env if needed

alembic upgrade head           # run database migrations

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at **http://localhost:8000**.  
Interactive API docs: **http://localhost:8000/docs**

### Step 4 — Start the frontend

In a separate terminal:

```bash
cd frontend

npm install
npm run dev
```

The frontend is available at **http://localhost:5173**.

---

## Running the Tests

### Backend tests

```bash
cd backend
source .venv/bin/activate

pytest -v
```

### Frontend tests

```bash
cd frontend
npm test
```

---

## Using the Application

### 1 — Create a farm

Click **New Farm** in the Farm Management panel (left). Enter a name and description. The farm appears in the sorted list immediately.

### 2 — Create a windmill

Select a farm, then click **New Windmill** in the Windmill Management panel (centre). Configure:

| Field | Description |
|---|---|
| Windmill ID | Unique identifier — alphanumeric, underscores, hyphens (e.g. `Turbine_01`) |
| Name / Description | Human-readable labels |
| Sensor Beat | How often sensor readings are generated (e.g. every 5 seconds) |
| Location Beat | How often the GPS heartbeat is recorded (e.g. every 1 day) |
| Latitude / Longitude | Geographic position |
| Sensor ranges | Four-handle slider per sensor — Floor, Normal Min, Normal Max, Ceiling |
| Rate slider | Maximum percentage change per beat (0–10 %) |

### 3 — Start the simulation

Select a windmill and click **Start**. The real-time signals chart (bottom-left) begins plotting live readings. The status badge changes to **Running**.

Use **Start All** / **Stop All** in the Farm panel to control all windmills in a farm at once.

### 4 — View real-time signals

The Signals chart shows the last 100 readings for the selected windmill across four sensors:

- **Temperature** (°C) — red line
- **Noise Level** (dB) — orange line
- **Humidity** (%RH) — blue line
- **Wind Speed** (km/h) — green line

Use the Y-axis mode selector to switch between Auto-scale, Normalize 0–100%, and Fixed domain.

When an anomaly is detected the chart border pulses red and a probability badge (`⚠ 87%`) appears in the chart header.

### 5 — Monitor the ML service status

A status badge in the top-right of the title bar shows the ML service health:

- **ML OK** (green) — the anomaly model is loaded and responding
- **ML unreachable** (red) — the service is down or not yet started; anomaly fields are stored as null for readings made during this period

### 6 — View history

Select a windmill to populate the History chart (bottom-right). Use the **minute / hour / day / week** tabs to change the time window. Red dashed vertical lines mark timestamps where the ML service flagged an anomaly. ETL must have been run for data to appear.

### 7 — Archive data (ETL)

Click **ETL** on a selected windmill to transfer its sensor readings — including anomaly results — from PostgreSQL to a Parquet file. The Parquet Files panel (right) lists all archives with their size and data time range.

Click **Farm ETL** in the Windmill Management header to archive all windmills in the current farm at once.

Running ETL clears the **Anomaly detected** indicator for that windmill (see below).

### 8 — Respond to anomaly alerts

When a windmill receives an anomalous reading, its row in the windmill list shows **Anomaly detected** below the status badge, with a tooltip: *"Execute the ETL for this wind turbine to visualize the anomaly time frame in the historical chart."*

The indicator persists until you run ETL for that windmill, at which point the anomalous readings are archived to Parquet and visible as red markers in the History chart.

### 9 — Edit a windmill

Click **Edit** while a windmill is selected. If it is running, the simulation pauses automatically and restarts when you save or cancel.

---

## Anomaly Detection

Every sensor reading is scored by the **Wind Turbine Assessment** ML service immediately after the values are generated.

### How it works

1. The backend sends `temperature`, `humidity`, and `noise_level` to `POST /api/v1/predict` on the ML service.
2. The service returns `potential_anomaly` (boolean) and `probability` (0–1 confidence score).
3. Both values are stored alongside the sensor reading in PostgreSQL and Parquet.
4. The WebSocket broadcast includes the anomaly result so the frontend can react immediately.

### Graceful degradation

If the ML service is unreachable or returns an error:

- The sensor loop continues without interruption.
- `potential_anomaly` and `anomaly_probability` are stored as `null` for that reading.
- The ML health badge in the title bar turns red.
- No anomaly markers appear in the History chart for null readings.

### Anomaly indicators summary

| Location | Indicator | Cleared by |
|---|---|---|
| Title bar | `ML OK` / `ML unreachable` badge | Automatic (30 s polling) |
| Windmill list row | "Anomaly detected" text + tooltip | Running ETL for that windmill |
| Signals chart | Pulsing red border + `⚠ XX%` badge | Next clean reading or stream stop |
| History chart | Red dashed vertical lines at anomaly timestamps | N/A — historical record |

---

## Simulation Algorithm

Each windmill runs an independent asyncio task that generates sensor values at the configured beat interval.

**First reading:** emitted after one full beat interval (not immediately on start).

**Subsequent values** follow a bounded random walk:

```
delta = uniform(−max_delta, +max_delta)
        where max_delta = (rate / 100) × (normal_max − normal_min)
next  = clamp(current + delta, clamp_min, spike_max)
```

**Spike injection:** approximately 5 % of readings jump to a value near `spike_max` to simulate transient events.

**Value continuity:** the last emitted values are stored in memory. On restart, the simulation seeds from those values rather than the range midpoint, so the chart line continues without a visible jump.

---

## Data Storage & ETL

| Store | Purpose |
|---|---|
| PostgreSQL | Live sensor readings with anomaly results, windmill config, location heartbeats |
| Parquet files | Long-term archive (`data/parquet/{windmill_id}.parquet`) written by the ETL pipeline |
| `notifications.jsonl` | Persistent append-only notification log |

**ETL is incremental:** it reads only rows newer than the latest timestamp already in the Parquet file, appends them (including anomaly columns), and overwrites the file. Running ETL repeatedly on the same windmill is safe.

**Parquet columns written:** `measurement_timestamp`, `temperature`, `noise_level`, `humidity`, `wind_speed`, `potential_anomaly`, `anomaly_probability`.

> If you deploy the ML integration for the first time on an existing instance, delete all existing Parquet files and re-run ETL. Old files do not have the anomaly columns and must be regenerated.

---

## Project Structure

```
FromModelToProduction/
├── wind_turbine_assessment/        ← ML service (separate project, required sibling)
│   ├── Dockerfile                  # Builds image and trains model at build time
│   ├── pipeline.py                 # Data wrangling + model training script
│   ├── src/api/                    # FastAPI application (port 8001)
│   └── requirements.txt
│
└── windmill_scanner/               ← this project
    ├── docker-compose.yml          # Dev: starts PostgreSQL only
    ├── docker-compose.prod.yml     # Prod: PostgreSQL + backend + nginx + ML service
    ├── backend/
    │   ├── main.py                 # FastAPI app entry point + CORS + lifespan
    │   ├── .env.example            # Environment variable template
    │   ├── requirements.txt        # Python dependencies (includes httpx)
    │   ├── domain/
    │   │   ├── models.py           # SQLAlchemy ORM models
    │   │   └── simulation.py       # Sensor value generation algorithm
    │   ├── infra/
    │   │   ├── db.py               # Database engine and session factory
    │   │   ├── anomaly_client.py   # httpx async client for the ML service
    │   │   ├── parquet.py          # ETL pipeline and history reader
    │   │   ├── sensor_repo.py      # Sensor readings repository
    │   │   ├── windmill_repo.py    # Windmill repository
    │   │   ├── farm_repo.py        # Farm repository
    │   │   ├── location_repo.py    # Location heartbeat repository
    │   │   └── notifications.py    # JSONL notification log writer
    │   ├── routers/
    │   │   ├── farms.py            # Farm CRUD + start/stop all + ETL
    │   │   ├── windmills.py        # Windmill CRUD + start/stop + history
    │   │   ├── anomaly.py          # GET /anomaly/health — ML service proxy
    │   │   ├── parquet.py          # Parquet file manager
    │   │   ├── notifications.py    # Notification list endpoint
    │   │   ├── websocket.py        # WebSocket sensor stream handler
    │   │   ├── sse.py              # Server-Sent Events notification stream
    │   │   ├── simulation.py       # Async simulation loop (sensor + location tasks)
    │   │   ├── ws_registry.py      # Active WebSocket connection registry
    │   │   └── task_registry.py    # In-process simulation task tracker
    │   └── alembic/
    │       └── versions/
    │           ├── 001_initial_schema.py
    │           └── 002_add_anomaly_columns.py
    └── frontend/
        └── src/
            ├── App.tsx             # Root layout, WebSocket + SSE lifecycle
            ├── store/useStore.ts   # Zustand global state (signals, anomaly, UI)
            ├── domain/types.ts     # Shared TypeScript types
            ├── infra/
            │   ├── api.ts          # Axios instance
            │   ├── ws.ts           # WebSocket client with exponential backoff
            │   └── sse.ts          # SSE EventSource client
            └── components/
                ├── FarmPanel.tsx
                ├── WindmillPanel.tsx   # Includes "Anomaly detected" row indicator
                ├── ParquetPanel.tsx
                ├── SignalsChart.tsx    # Pulsing border + probability badge on anomaly
                ├── HistoryChart.tsx    # Red ReferenceLine markers at anomaly timestamps
                ├── NotificationsPanel.tsx
                ├── CreateWindmillForm.tsx
                ├── EditWindmillForm.tsx
                ├── AboutModal.tsx
                └── ConfirmDialog.tsx
```

---

## API Reference

Full interactive documentation is available at:

- **Local dev:** http://localhost:8000/docs
- **Docker prod:** http://localhost/docs
- **ML service:** http://localhost:8001/docs

### Farms

| Method | Path | Description |
|---|---|---|
| `GET` | `/farms` | List all farms |
| `POST` | `/farms` | Create a farm |
| `DELETE` | `/farms/{id}` | Delete a farm (blocked if it has windmills) |
| `POST` | `/farms/{id}/start` | Start all windmills in a farm |
| `POST` | `/farms/{id}/stop` | Stop all windmills in a farm |
| `POST` | `/farms/{id}/etl` | Archive all windmills in a farm to Parquet |

### Windmills

| Method | Path | Description |
|---|---|---|
| `GET` | `/farms/{id}/windmills` | List windmills in a farm (includes `latest_anomaly`) |
| `POST` | `/windmills` | Create a windmill |
| `GET` | `/windmills/{id}` | Get windmill details |
| `PUT` | `/windmills/{id}` | Update windmill configuration |
| `DELETE` | `/windmills/{id}` | Delete a windmill (blocked if running) |
| `POST` | `/windmills/{id}/start` | Start simulation |
| `POST` | `/windmills/{id}/stop` | Stop simulation |
| `GET` | `/windmills/{id}/history` | Get archived sensor history from Parquet (`?scale=minute\|hour\|day\|week`) |
| `POST` | `/windmills/{id}/etl` | Archive sensor readings to Parquet |

### Parquet files

| Method | Path | Description |
|---|---|---|
| `GET` | `/parquet-files` | List all Parquet archive files |
| `DELETE` | `/parquet-files/{id}` | Delete a Parquet file (blocked if windmill is running) |

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List recent notification log entries |
| `GET` | `/notifications/stream` | SSE stream — pushes new notifications in real time |

### Anomaly detection

| Method | Path | Description |
|---|---|---|
| `GET` | `/anomaly/health` | ML service health check (proxied from `ANOMALY_SERVICE_URL`) |

### Real-time

| Protocol | Path | Description |
|---|---|---|
| `WS` | `/ws/{windmill_id}` | WebSocket sensor data stream — reading, status, and anomaly messages |

---

*Rights Notice: The author donates all rights over this work to IU Internationale Hochschule for any academic purpose the institution considers appropriate. The source code may be used, adapted, or redistributed freely for academic and educational purposes.*
