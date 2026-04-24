# Project Context — Windmill Scanner

## Purpose

A web application that simulates sensor data generation from windmills organized into farms around the world.
Users manage farms and windmills (create/delete), control data simulation (start/stop per windmill and per farm),
and visualize sensor signals both in real time and historically. The primary audience is operators or engineers
monitoring windmill infrastructure in a simulation environment. No external physical data sources are connected.

---

## Tech Stack

### Frontend

- Language: TypeScript 5.x (strict)
- Framework: React 18 + Vite
- Styling: Tailwind CSS + shadcn/ui
- Routing: React Router v6 (single-page layout — no multi-route navigation between modules)
- HTTP client: axios (instance-based; global interceptor shows a UI toast on API errors — does NOT write to backend)
- Server state (REST): TanStack Query v5 — caching, loading/error states, mutations for ETL and CRUD
- Client/stream state: Zustand — WebSocket sensor reading buffer + UI state (selected farm, selected windmill, modals)
- Chart library: Recharts (React-native JSX API, handles real-time incremental data)
- Real-time transport (Signals): WebSocket /ws/{windmill_id} — server pushes sensor readings (IoT push model)
- Real-time transport (Notifications): SSE GET /notifications/stream — EventSource API, one-way server push
- Test framework: Vitest (co-located with source files)
- Error handling: try/catch — standard JavaScript; no Result<T,E> wrapper

### Backend

- Language: Python 3.11+
- Framework: FastAPI
- ORM: SQLAlchemy (not SQLModel) — minimalist
- Migrations: Alembic
- Primary storage: PostgreSQL
- Analytics storage: Parquet files — ./data/parquet/{windmill_id}.parquet
- ETL: synchronous, incremental (see ETL Algorithm section)
- ETL libraries: pandas + pyarrow
- History sampling: per-bucket representative sampling (see History Sampling section)
- Test framework: pytest (co-located with source files)
- Simulation loop: two asyncio tasks per windmill (sensor loop + location loop); both cancelled on stop.
  In-process task registry (dict keyed by windmill_id) stores task handles + last emitted sensor values.

### Authentication

None required. All endpoints are public.

### Environment configuration

Backend credentials in backend/.env (not committed to git).
backend/.env.example (committed) shows the required variables:
DATABASE_URL=postgresql://username:password@localhost:5432/windmill_scanner
PARQUET_DATA_PATH=./data/parquet
LOG_FILE_PATH=./data/notifications.jsonl
CORS_ORIGINS=http://localhost:5173

Frontend env in frontend/.env.local:
VITE_API_BASE_URL=http://localhost:8000
WebSocket URL is derived from VITE_API_BASE_URL by replacing the protocol:
  http:// → ws://   (development)
  https:// → wss://  (production/TLS)
No separate WS env var is needed — a single VITE_API_BASE_URL drives both REST and WebSocket.

A docker-compose.yml at the project root provides local PostgreSQL.
Image: postgres:16, database: windmill_scanner, port: 5432
Default credentials: postgres/postgres (overridable via DATABASE_URL in .env)

---

## Page Layout (single page — no route changes between modules)

Fixed-viewport layout: the page fills the screen height exactly (h-screen, no page-level scrollbar).
Each panel and chart area has a fixed height and scrolls internally when content overflows.

Row height proportions (of total screen height):
  Title bar:    ~3rem fixed
  Panels row:   ~35% of remaining height (after title)
  Charts row:   ~35% of remaining height
  Notifications: remainder (~30% of remaining height)

The entire application lives on one page with this vertical layout:

Row 1: App title bar (small, full width) — title text: "Windmill Data Stream Simulator (IU)"

Row 2: Three equal-width panels side by side
Left panel: Farm Management
Scrollable list of all farms.
Clicking a farm selects it and loads its windmills in the middle panel.
No farm is selected on initial load — middle panel shows a prompt.
Farm row displays: Farm Name + Farm ID. Hovering shows the farm description.
Windmill counts shown at the bottom of the row with traffic-light icons:
  green icon = running_count, red icon = (windmill_count − running_count), plain number = total.
Empty state (no farms exist): centred prompt "No farms yet. Click 'New Farm' to get started."
Create form: toggled — a "New Farm" button reveals the creation form; hidden when not in use.
Farm creation fields: name (required, text), description (required, text). Both must be
non-empty before the form can be submitted.
A fixed control bar at the BOTTOM of the left panel shows actions for the selected farm:
  Start All — starts all stopped windmills in the farm.
  Stop All  — stops all running windmills in the farm.
  Delete    — requires a confirmation modal; blocked (409) if windmill_count > 0.
If no farm is selected, the control bar buttons are disabled (grayed).
Deleting the selected farm deselects it: middle panel returns to "No farm selected" prompt.

    Middle panel: Windmill Management
                  When no farm is selected: centred prompt "Select a farm to view its windmills".
                  When a farm is selected but has no windmills: centred prompt
                  "No windmills in this farm. Click 'New Windmill' to add one."
                  Farm-level ETL button in the panel header.
                  When no farm is selected: button is visible but disabled (grayed);
                  tooltip: "Select a farm first."
                  When a farm is selected: button enabled; tooltip: "Move all the signal per
                  windmill in this farm from the database to parquet (archive) files."
                  Windmill list row displays: name (primary label) + windmill_id (secondary, smaller)
                  + is_running status badge + sensor_beat (with unit) + location_beat (with unit).
                  Clicking a windmill row selects it and activates both charts.
                  Clicking the already-selected windmill row is a no-op — nothing changes.
                  Farm change: clicking a different farm automatically deselects the current windmill
                  (WebSocket closes, charts reset to placeholder, selectedWindmillId → null),
                  then the new farm's windmill list loads.
                  Windmill creation form: toggled — a "New Windmill" button reveals the form;
                  hidden when not in use.
                  "New Windmill" button is always visible but disabled (grayed) when no farm is
                  selected. Tooltip on hover: "A farm must be first selected." When a farm IS
                  selected the tooltip reads: "Create a new windmill."
                  When the form opens, the left (Farm) and right (Parquet) panels both collapse
                  automatically — the middle panel expands to full width. Both panels restore to
                  their original widths when creation completes (save or cancel).
                  Windmill edit: INLINE (no modal). An edit button switches the panel
                  from "list mode" to "edit mode" — the windmill list is replaced by the edit form.
                  Navigating back (cancel/save) returns to "list mode". modalState is not used for edit.
                  Stream behaviour during edit: if the windmill is running when Edit is opened,
                  the stream is automatically stopped (implicit stop — frontend calls POST /stop,
                  chart enters "Stream Stopped" state). Zustand stores wasRunningBeforeEdit flag.
                  On Save: PUT applied, then auto-restart (POST /start) if wasRunningBeforeEdit.
                  On Cancel: discard changes, auto-restart (POST /start) if wasRunningBeforeEdit.
                  Panel-level control bar (applies to the SELECTED windmill):
                  All five buttons are disabled (grayed) when no windmill is selected.
                    Start — also disabled if selected windmill is already running.
                    Stop  — also disabled if selected windmill is already stopped.
                    Edit  — (no additional disable condition beyond no-selection)
                    Delete — requires a confirmation modal; also disabled if running.
                    ETL   — disabled while ETL is in-flight (shows spinner).
                            Tooltip when enabled: "Move signals for this windmill from the
                            database to its parquet (archive) file."
                            Tooltip when disabled/in-flight: "ETL in progress…"
                  No windmill is selected until explicitly clicked.

    Right panel:  Parquet File Manager
                  List of all .parquet files (name, size, last modified, in-use status).
                  Delete button per file (blocked if in-use, no confirmation dialog).
                  Empty state (no files yet): centred prompt
                  "No archive files yet. Run ETL on a windmill to generate one."

Row 3: Two equal-width chart panels (always rendered, activate on windmill selection)
Left chart: Signals — real-time WebSocket sensor readings
When no windmill selected: centred "Select a windmill to view data" placeholder.
On windmill selection: buffer clears, chart starts empty, fills as readings arrive.
While wsStatus = "connecting": empty chart (axes visible, no lines) with a loading spinner
and a "Connecting…" label overlay.
Four coloured lines (temperature, noise_level, humidity, wind_speed) on a single shared y-axis.
Legend identifies each line.
X-axis: measurement_timestamp displayed as clock time (HH:MM:SS). Time advances left to right.
Rolling window: last 100 readings; oldest entries dropped beyond that.
Y-axis mode: user-selectable combobox with three options (see Y-axis Mode section below).
When windmill is stopped: chart lines turn grey/muted + an overlay badge reads "Stream Stopped".
When wsStatus = "error": chart lines turn grey/muted + an overlay badge reads "Connection Error"
+ a "Reconnect" button in the overlay. Clicking "Reconnect" resets wsStatus → "connecting"
and opens a new WebSocket connection (re-entering the normal connect flow).
When running: normal coloured lines.

    Right chart:  History — with time-scale selector (minute / hour / day / week)
                  Default scale: minute.
                  ALL scales read from Parquet — ETL must have been run for any data to appear.
                  When no windmill selected: centred "Select a windmill to view data" placeholder.
                  Empty for any scale until ETL has been run (shows "No data available for this
                  time range" placeholder).
                  Four lines (temperature, noise_level, humidity, wind_speed) on a shared y-axis.
                  Y-axis mode: user-selectable combobox (see Y-axis Mode section below).
                  X-axis: scale-adaptive timestamp format:
                    minute / hour → HH:MM:SS
                    day           → HH:MM
                    week          → MMM DD HH:MM  (e.g., "Apr 24 14:32")
                  Time-scale control re-fetches and re-renders on change.
                  Unaffected by windmill running state.
                  When ETL has run but the selected time window contains 0 data points:
                  shows "No data available for this time range" — same placeholder used
                  regardless of whether it is pre-ETL or just an empty window.

Row 4: Notifications panel (full width, persistent)
Shows all notification log entries, newest first.
Updates in real time via SSE (entries appended as they arrive).
Manual refresh button re-fetches the full list via REST.
Clear button empties the Zustand notification store (frontend only — does not delete the log file).
Frontend cap: 500 entries. Oldest entries are dropped when the store exceeds 500.
Each row displays: timestamp (HH:MM:SS) + " — " + message.
If the message does not fit the row width, it is truncated; hovering shows the full entry
(all fields: timestamp, level, entity_type, entity_id, message) in a tooltip.
Visual distinction: info entries use normal text; error entries use a soft red tint
(e.g., light red background or muted red text — not aggressive, just distinguishable).

---

## HTTP Conventions

### Success codes

201 POST (resource created) — response body: full created object
200 GET, PUT, POST (actions: start/stop/etl)
204 DELETE

### Error codes

409 Conflict — two cases:
  (1) Blocked operations: farm has windmills (DELETE), windmill is running (DELETE/start)
  (2) Uniqueness conflicts on creation: duplicate farm name (POST /farms), duplicate windmill_id
      (POST /windmills). Message: "A farm with this name already exists." /
      "This windmill ID is already in use."
404 Not Found
422 Validation failure (FastAPI default)
Error body: FastAPI default { "detail": "message string" }

---

## REST API Endpoint Inventory

All responses are JSON. All timestamps are ISO 8601. No pagination.
List endpoints return all fields of each object.

### Farms

GET /farms
Response: [ { id, name, description, windmill_count, running_count, created_at }, ... ]

POST /farms { name, description }
Response 201: { id, name, description, windmill_count: 0, running_count: 0, created_at }

DELETE /farms/{farm_id}
Response 204. BLOCKED (409) if windmill_count > 0.

### Windmills

GET /farms/{farm_id}/windmills
Response: [ { id, windmill_id, name, description, farm_id, is_running,
              sensor_beat, sensor_beat_unit, location_beat, location_beat_unit,
              lat, lat_dir, lon, lon_dir,
              temp_clamp_min, temp_normal_min, temp_normal_max, temp_spike_max,
              noise_clamp_min, noise_normal_min, noise_normal_max, noise_spike_max,
              humidity_clamp_min, humidity_normal_min, humidity_normal_max, humidity_spike_max,
              wind_clamp_min, wind_normal_min, wind_normal_max, wind_spike_max,
              temp_rate, noise_rate, humidity_rate, wind_rate,
              created_at }, ... ]

POST /windmills (all Windmill Form Fields + farm_id derived from selected farm)
Response 201: full windmill object (all columns)

GET /windmills/{windmill_id}
Response 200: full windmill object

PUT /windmills/{windmill_id} (editable fields only)
Response 200: full updated windmill object.
All editable fields can be updated at any time (PUT only called when stream is stopped, per edit-mode flow).
windmill_id and farm_id are immutable.

DELETE /windmills/{windmill_id}
Response 204. BLOCKED (409) if is_running.

### Windmill Control

POST /windmills/{windmill_id}/start
Response 200: { "windmill_id": "Windmill_1234", "is_running": true }
If already running: 409 "Windmill is already running."

POST /windmills/{windmill_id}/stop
Response 200: { "windmill_id": "Windmill_1234", "is_running": false }
If already stopped: 200 (idempotent — stopping a stopped windmill is harmless).
Side effect: server pushes { "type": "status", "status": "stopped", ... } to all open
WebSocket connections for this windmill_id (see WebSocket section).

POST /farms/{farm_id}/start (best-effort: continues on individual errors)
Response 200: { "started": ["Windmill_1", "Windmill_2"],
               "already_running": ["Windmill_3"],
               "errors": [{"windmill_id": "X", "reason": "..."}] }
Windmills that were already running are reported in "already_running" — not errors, not started.

POST /farms/{farm_id}/stop (best-effort: continues on individual errors)
Response 200: { "stopped": ["Windmill_1", "Windmill_2"], "errors": [{"windmill_id": "X", "reason": "..."}] }
Side effect: server pushes status: stopped to all open WebSocket connections for each stopped windmill.

### ETL (synchronous — blocks until complete)

POST /windmills/{windmill_id}/etl
Response 200: { "windmill_id": "Windmill_1234", "rows_written": 412 }
Notification written on both success and failure.
UI disables the ETL button and shows a loading spinner while in-flight.

POST /farms/{farm_id}/etl (sequential, best-effort across all windmills in farm)
Response 200: { "succeeded": ["Windmill_A", "Windmill_B"], "errors": [{"windmill_id": "X", "reason": "..."}] }
Notification written per windmill on success and failure.

### History (all scales read from Parquet)

GET /windmills/{windmill_id}/history?scale={minute|hour|day|week}
Response 200: [ { measurement_timestamp, temperature, noise_level, humidity, wind_speed }, ... ]
All scales read from Parquet — requires ETL to have been run.
minute scale: returns raw 1:1 rows for the last 1 minute — no bucketing, no sampling.
hour/day/week scales: up to 200 sampled points (see History Sampling Algorithm).
For all scales: empty array if Parquet file does not exist or time window contains no data.

### Parquet File Manager

GET /parquet-files
Response: [ { windmill_id, size_bytes, modified_at, in_use }, ... ]

DELETE /parquet-files/{windmill_id}
Response 204. BLOCKED (409) if in_use.

### Notifications

GET /notifications
Response: [ ...notification entry..., ] (newest first, last 200 entries max)

GET /notifications/stream
SSE stream — pushes new entries in real time (see SSE section)

---

## ETL Algorithm

Incremental — only new rows are transferred on each run. Full history is never re-read.

Per-windmill algorithm:

1. Accept windmill_id as the parameter.
2. Check if the Parquet file ./data/parquet/{windmill_id}.parquet exists.
   - If it does not exist: create it; the cutoff timestamp is the Unix epoch (all rows qualify).
   - If it exists: read the file and find max(measurement_timestamp) — this is the cutoff.
3. Query PostgreSQL: SELECT \* FROM sensor_readings
   WHERE windmill_id = ? AND measurement_timestamp > cutoff
   ORDER BY measurement_timestamp ASC
4. If the result set is empty: write notification "ETL complete — 0 new rows", return.
5. Convert the result to a pandas DataFrame; write/append to Parquet using pyarrow.
   - First run (file did not exist): write new file.
   - Subsequent runs: read existing Parquet, concatenate new rows, overwrite file.
     (Parquet does not support true append; re-write is the standard pandas/pyarrow approach.)
6. Write success notification: "ETL complete — {N} rows written for {windmill_id}".

On any exception: write error notification and re-raise (FastAPI returns 500).

Farm-level ETL runs the per-windmill algorithm for each windmill in the farm, sequentially.
Errors on individual windmills are caught and collected; processing continues for remaining windmills.

---

## History Sampling Algorithm

Strategy: per-bucket representative sampling (spike-preserving downsampling).
Chosen because: it preserves spikes (which plain averaging would lose), produces a fixed
output size (up to 200 points) regardless of data volume, and is simple to implement with pandas.

Default scale on windmill selection: minute.
All scales read from Parquet. ETL must have been run for any scale to show data.

Time windows (applied from "now" backward):
minute = last 1 minute — returns raw Parquet rows, no sampling (skip steps 2–3; filter and return directly)
hour   = last 1 hour
day    = last 24 hours
week   = last 7 days

Algorithm (unified representative point — one reading selected per bucket for all four sensors):

1. Filter Parquet data to the time window.
2. Divide the window into 200 equal-duration time buckets.
3. For each bucket, compute the per-sensor bucket mean across all readings in that bucket.
   For each reading, compute its composite deviation score: the sum of its absolute deviations
   from the bucket mean for each sensor, each normalized by that sensor's value range
   (spike_max − clamp_min). The range config is read from the windmills table at query time
   (single indexed row fetch by windmill_id — negligible overhead vs the Parquet read).
   This keeps the API clean (no 16 query parameters), always uses the current config, and
   ensures all four sensors contribute equally regardless of unit scale.
   Select the single reading with the highest composite deviation score.
   Report that reading's real measurement_timestamp and all four sensor values together.
4. If a bucket has no readings, it is omitted (result has fewer than 200 points).

The measurement_timestamp in each result point is the real timestamp of the selected reading,
not a synthetic bucket midpoint. All four sensor values come from the same physical reading.

Response shape per point:
{ "measurement_timestamp": "...", "temperature": 42.3, "noise_level": 61.1,
  "humidity": 58.7, "wind_speed": 12.4 }

---

## Chart Y-axis Mode

Both the Signals chart and the History chart include a combobox that lets the user choose
how the shared y-axis is scaled. The three options are:

**"Auto-scale"** — Recharts auto-adjusts the y-axis domain to the min/max of values currently
in the buffer/window. All four lines fill the visible area naturally. Domain updates as
new readings arrive (Signals) or when ETL data changes (History).

**"Normalize to 0–100%"** — Each sensor value is converted to a percentage of its own
[clamp_min, spike_max] range before rendering:
  normalized = (value − clamp_min) / (spike_max − clamp_min) × 100
Y-axis shows 0–100 (percent). All lines are visually comparable regardless of their unit scale.
Range config (clamp_min, spike_max) is taken from the selected windmill's stored configuration.

**"Fixed domain"** — Y-axis is fixed to a static range derived from the selected windmill's
own stored configuration:
  domain min = min(temp_clamp_min, noise_clamp_min, humidity_clamp_min, wind_clamp_min)
  domain max = max(temp_spike_max, noise_spike_max, humidity_spike_max, wind_spike_max)
This is computed on the frontend from the already-loaded windmill object — no extra API call.
The range updates if the user edits the windmill's sensor range settings and restarts.

Default mode: "Auto-scale".
Each chart has its own independent combobox — changing the Signals chart mode does not
affect the History chart mode, and vice versa.

---

## WebSocket Message Protocol

Endpoint: ws://{host}/ws/{windmill_id}
All messages are JSON with a required "type" discriminator field.

On connect (windmill is RUNNING): server sends status: started, then readings as they arrive.
On connect (windmill is STOPPED): server accepts the connection and immediately sends status: stopped.
The client enters the stopped visual state without waiting for any reading.
On connect (unknown windmill_id): server accepts the connection, sends type: error, then closes.
Does not silently reject.
On client receives type: error: PERMANENT FAILURE — client closes connection, sets wsStatus to "error",
and halts all reconnection attempts. Does NOT enter the backoff retry loop.
Distinct code path from a plain TCP close event, which does trigger backoff.

On REST stop (windmill is RUNNING, clients are connected):
When POST /windmills/{id}/stop or POST /farms/{id}/stop is called, the server pushes
{ "type": "status", "status": "stopped", ... } to ALL currently open WebSocket connections
for that windmill_id. This is the mechanism by which the Signals chart flips to the
"Stream Stopped" visual without the client needing to poll.

Message types:

Sensor reading (server -> client, emitted once per sensor beat interval while running):
{
"type": "reading",
"windmill_id": "Windmill_1234",
"measurement_timestamp": "2024-01-01T00:00:05Z",
"db_timestamp": "2024-01-01T00:00:05Z",
"readings": {
"temperature": { "value": 42.3, "unit": "C" },
"noise_level": { "value": 61.1, "unit": "dB" },
"humidity": { "value": 58.7, "unit": "%RH" },
"wind_speed": { "value": 12.4, "unit": "km/h" }
}
}

Status message (server -> client):
{
"type": "status",
"status": "started" | "stopped",
"windmill_id": "Windmill_1234",
"message": "Data Stream from windmill Windmill_1234 started"
}

Error message (server -> client, sent before close on unknown windmill_id):
{
"type": "error",
"message": "Windmill not found"
}

Status messages are also written to the backend notification log file.

---

## Simulation Loop Behaviour

- First reading: the simulation loop waits one full sensor beat interval before emitting the first
  reading. The loop does not emit immediately on start.
- Task structure: two asyncio tasks per windmill — one for the sensor reading loop, one for the
  location heartbeat loop. Each task sleeps for its own beat interval independently. Both tasks
  are cancelled when the windmill is stopped.
- Edit mode stops stream: when the frontend opens edit mode for a running windmill, it calls
  POST /windmills/{id}/stop. The chart enters "Stream Stopped" state. Zustand records
  wasRunningBeforeEdit = true. On Save: PUT then POST /start. On Cancel: POST /start.
  Both paths auto-restart the stream if wasRunningBeforeEdit is true.
- Last-value preservation: the in-process task registry stores the last emitted sensor values
  per windmill_id (keyed dict: windmill_id → {temperature, noise_level, humidity, wind_speed}).
  When a task is cancelled for any reason (stop, delete, edit), the last values are retained.
  When the windmill is started again, the simulation seeds from those stored values instead of
  the midpoint — ensuring the chart line continues seamlessly without a visible jump.
  If no stored values exist (windmill never ran): seeds from midpoint of each sensor's normal range.
- WebSocket push on stop: when the stop REST endpoint cancels the tasks, it also pushes
  status: stopped through all open WebSocket connections for that windmill (see WebSocket section).
- WebSocket reconnect strategy (client-side): exponential backoff starting at 1 second, doubling
  up to 30 seconds max. wsStatus transitions to "error" after 5 consecutive failed attempts.
  Exception: receiving a server-sent type: error message is a permanent failure — no backoff,
  no retry; wsStatus → "error" immediately and stays there.
  Recovery from "error": a "Reconnect" button appears in the Signals chart overlay. Clicking it
  resets wsStatus → "connecting" and opens a fresh WebSocket connection from scratch.
  If the server immediately sends type: error again (e.g., windmill was deleted), wsStatus
  returns to "error". The button remains available for the user to try again.
- signalsBuffer: rolling last 100 readings. Oldest entries are dropped when the buffer exceeds 100.
  Buffer is cleared every time a windmill is selected or deselected (no persistence between selections).
- Windmill deselect: WebSocket is closed, wsStatus → "idle", signalsBuffer cleared.
- Farm change: selecting a different farm triggers windmill deselect (same effect as above —
  WS closes, wsStatus → "idle", signalsBuffer cleared, selectedWindmillId → null) before
  the new farm's windmill list loads.
- WebSocket on windmill delete: windmill must be stopped before deletion, so the WS is already
  in stopped state. Server sends type: error before closing the connection, so the client treats
  it as permanent failure (no backoff retry).
- Location simulation: STATIC — writes the windmill's fixed lat/lon unchanged on each location beat.
  Coordinates only change when the user manually edits them via PUT.
- Backend restart: all is_running flags are reset to false on startup. Simulation tasks are
  in-process and do not survive a restart. Users must re-start windmills manually after restart.

---

## SSE Notification Format

Endpoint: GET /notifications/stream (Content-Type: text/event-stream)

New entry event:
data: {"type": "new_notification", "entry": { ...notification entry... }}

Keepalive (every 30s to prevent proxy timeout):
data: {"type": "keepalive"}

Client appends each "new_notification" entry to the Zustand notification store.
On SSE reconnect: the frontend does NOT re-fetch the notification list — any gap during
disconnection is accepted. The stream resumes from the new tail of the log file.

---

## Notification Log File

Format: JSONL (JSON Lines) — one JSON object per line, newline-separated.
Path: configurable via LOG_FILE_PATH env var, default ./data/notifications.jsonl
Append-only. Never truncated or rotated in v1.

GET /notifications reads the entire file and returns the last 200 entries, newest first.
SSE watcher tails the file (tracks byte offset, reads new lines as they are appended).

Notification entry schema:
{
"timestamp": "2024-01-01T00:00:00Z", // ISO 8601, when the event occurred
"level": "info" | "error",
"message": "Human-readable description",
"entity_type": "farm" | "windmill" | "system",
"entity_id": "Windmill_1234" // null for system-level events
}

Events that produce a notification:

- Farm created / deleted
- Windmill created / deleted
- Farm or windmill creation failed due to duplicate name / windmill_id (level: "error")
- Windmill or farm stream started / stopped (also sent via WebSocket status message)
- ETL completed (success or failure, per windmill)
- Any unhandled exception
- Database connection errors

---

## Deletion and Lifecycle Rules

### Farm deletion

BLOCKED (409) if the farm has one or more windmills.
Error: "Remove all windmills from this farm before deleting it."
Requires confirmation modal before the DELETE request is sent.
Modal body: "Are you sure you want to delete {farm_name}? This cannot be undone."
Modal buttons: "Delete" (primary, destructive) / "Cancel"

### Windmill deletion

BLOCKED (409) if is_running = true.
Error: "Stop the windmill data stream before deleting it."
Requires confirmation modal before the DELETE request is sent.
Modal body: "Are you sure you want to delete {windmill_name}? This cannot be undone."
Modal buttons: "Delete" (primary, destructive) / "Cancel"
When deleted (while stopped):
- PostgreSQL sensor_readings and location_heartbeats records are RETAINED.
- Parquet file is RETAINED.
- Open WebSocket connections to this windmill_id receive type: error then are closed by the server.
- If the deleted windmill was selected: both charts reset to placeholder, wsStatus → "idle",
  signalsBuffer cleared, selectedWindmillId → null.
Re-creating a windmill with the same windmill_id reuses all retained data.

### Windmill update (PUT)

NOT blocked by is_running. All editable fields can be updated at any time (running or stopped).
Immutable fields (never editable): windmill_id, farm_id.
Editable fields: name, description, sensor_beat, sensor_beat_unit, location_beat,
location_beat_unit, lat, lat_dir, lon, lon_dir, all 16 sensor range columns, and
rate-of-variation columns (temp_rate, noise_rate, humidity_rate, wind_rate).

### Parquet file deletion

BLOCKED (409) if in_use = true (matching windmill exists in PostgreSQL and is_running = true).
Error: "Stop windmill {id} before deleting its Parquet file."
If the windmill has been deleted, the file is not in_use and can be deleted freely.
No confirmation dialog.

### Farm-level start/stop

Best-effort: iterates all windmills, continues on individual errors.
Response for /start: { "started": [...], "already_running": [...], "errors": [...] }
Response for /stop: { "stopped": [...], "errors": [...] }
For /stop: already-stopped windmills are counted in "stopped" (stop is idempotent).
For /start: already-running windmills go in "already_running", not "errors" and not "started".

---

## Windmill Form Fields

Structured form — no JSON editor. Inline in the middle panel; no modal.
Creation mode: all fields pre-filled with the DB default values (sensor_beat=5 ss,
location_beat=1 dd, lat=0 N, lon=0 E, sensor ranges as documented, all rates=2.0).
User only changes fields that differ from the defaults.

### Identity fields (creation only — immutable after creation)
windmill_id   Text, max 32 characters, unique, user-defined.
              Allowed characters: alphanumeric, underscore, hyphen (^[a-zA-Z0-9_-]+$).
              Validated in the form (live) and in the backend (422 on violation).
farm_id       Set from currently selected farm — not shown in the form

### Editable fields (available at creation and in edit mode)
name          Text, max 60 characters, required — human-friendly display name (mutable, not unique)
description   Text, max 100 characters, required
sensor_beat   Integer, min 1. Max depends on unit (enforced in form live + backend):
              ss → max 86400 | mm → max 1440 | hh → max 24 | dd → max 1
              Total duration must be ≥ 1 second and ≤ 86400 seconds (1 day).
sensor_beat_unit Select: ss | mm | hh | dd
location_beat Integer, min 1. Same dynamic max rules as sensor_beat.
location_beat_unit Select: ss | mm | hh | dd
lat           Decimal, range −90 to 90 (required)
lat_dir       Select: N | S
lon           Decimal, range −180 to 180 (required)
lon_dir       Select: E | W

### Sensor range controls (4-point range slider per sensor, shown at creation and in edit mode)
Each sensor has a range control with 4 draggable boundary values:
  [clamp_min, normal_min, normal_max, spike_max]
clamp_min  = absolute lower bound (simulation never goes below this)
normal_min = lower bound of normal operating range
normal_max = upper bound of normal operating range
spike_max  = absolute upper bound (spike target)

Slider physical bounds (handles cannot be dragged outside these):
  Temperature:  min −30, max 500 °C
  Noise level:  min 0,   max 180 dB
  Humidity:     min 0,   max 99 %RH
  Wind speed:   min 0,   max 200 km/h

Defaults (pre-filled within those bounds):
  Temperature:  [0, 20, 50, 200] °C
  Noise level:  [0, 5, 60, 180] dB
  Humidity:     [0, 10, 90, 99] %RH
  Wind speed:   [0, 2, 45, 200] km/h

### Rate-of-variation controls (horizontal slider per sensor)
One slider per sensor: temp_rate, noise_rate, humidity_rate, wind_rate.
Range: 0.0 – 10.0 (percent). Default: 2.0.
Controls the maximum delta per simulation step: delta ∈ [−rate% × normal_range, +rate% × normal_range].

### Range slider constraint
The 4-handle range slider physically prevents handles from crossing:
clamp_min handle cannot exceed normal_min; normal_min cannot exceed normal_max; etc.
Ordering enforced by the slider component — no separate submit validation needed.

All fields are required at creation.
All editable fields (description, beats, coordinates, ranges, rates) can be updated at any time
(running or stopped) — no fields are blocked by is_running.

### Form error handling
Validation errors (client-side and API) are shown inline — a red message directly below
the offending field. No toast is shown for form validation failures (422) or conflict errors (409).
Form mutations must suppress the global axios toast interceptor (e.g., via a per-request flag
such as { skipGlobalErrorHandler: true }) so the interceptor does not also fire a toast.
The global toast interceptor remains active for all non-form API calls.

Uniqueness conflict (409) dual reporting:
  - Frontend: error shown inline on the conflicting field (name field for farms;
    windmill_id field for windmills).
  - Backend: also writes a notification log entry (level: "error") so the failure appears
    in the Notifications panel. Example messages:
      "Farm name 'Green Valley' already exists — creation failed."
      "Windmill ID 'Turbine_01' already exists — creation failed."

---

## PostgreSQL Table Schemas

### farms

id SERIAL PRIMARY KEY
name VARCHAR(255) UNIQUE NOT NULL
description TEXT NOT NULL DEFAULT ''
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### windmills

id SERIAL PRIMARY KEY
windmill_id VARCHAR(32) UNIQUE NOT NULL
name VARCHAR(60) NOT NULL DEFAULT ''    -- human-friendly mutable display name; max 60 characters
description VARCHAR(100) NOT NULL DEFAULT ''
farm_id INT NOT NULL REFERENCES farms(id) ON DELETE RESTRICT
is_running BOOLEAN NOT NULL DEFAULT FALSE
sensor_beat INT NOT NULL DEFAULT 5
sensor_beat_unit VARCHAR(2) NOT NULL DEFAULT 'ss'
location_beat INT NOT NULL DEFAULT 1
location_beat_unit VARCHAR(2) NOT NULL DEFAULT 'dd'
lat FLOAT NOT NULL DEFAULT 0.0
lat_dir CHAR(1) NOT NULL DEFAULT 'N'
lon FLOAT NOT NULL DEFAULT 0.0
lon_dir CHAR(1) NOT NULL DEFAULT 'E'
-- Temperature range
temp_clamp_min FLOAT NOT NULL DEFAULT 0
temp_normal_min FLOAT NOT NULL DEFAULT 20
temp_normal_max FLOAT NOT NULL DEFAULT 50
temp_spike_max FLOAT NOT NULL DEFAULT 200
-- Noise level range
noise_clamp_min FLOAT NOT NULL DEFAULT 0
noise_normal_min FLOAT NOT NULL DEFAULT 5
noise_normal_max FLOAT NOT NULL DEFAULT 60
noise_spike_max FLOAT NOT NULL DEFAULT 180
-- Humidity range
humidity_clamp_min FLOAT NOT NULL DEFAULT 0
humidity_normal_min FLOAT NOT NULL DEFAULT 10
humidity_normal_max FLOAT NOT NULL DEFAULT 90
humidity_spike_max FLOAT NOT NULL DEFAULT 99
-- Wind speed range
wind_clamp_min FLOAT NOT NULL DEFAULT 0
wind_normal_min FLOAT NOT NULL DEFAULT 2
wind_normal_max FLOAT NOT NULL DEFAULT 45
wind_spike_max FLOAT NOT NULL DEFAULT 200
-- Rate-of-variation (max delta per step as % of normal_range; 0.0–10.0)
temp_rate FLOAT NOT NULL DEFAULT 2.0
noise_rate FLOAT NOT NULL DEFAULT 2.0
humidity_rate FLOAT NOT NULL DEFAULT 2.0
wind_rate FLOAT NOT NULL DEFAULT 2.0
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### sensor_readings

id SERIAL PRIMARY KEY
windmill_id VARCHAR(32) NOT NULL
measurement_timestamp TIMESTAMPTZ NOT NULL
db_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
temperature FLOAT NOT NULL
noise_level FLOAT NOT NULL
humidity FLOAT NOT NULL
wind_speed FLOAT NOT NULL

Indexes: (windmill_id), (measurement_timestamp)
Note: windmill_id is NOT a FK — records survive windmill deletion by design.

### location_heartbeats

id SERIAL PRIMARY KEY
windmill_id VARCHAR(32) NOT NULL
measurement_timestamp TIMESTAMPTZ NOT NULL
db_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
lat FLOAT NOT NULL
lat_dir CHAR(1) NOT NULL
lon FLOAT NOT NULL
lon_dir CHAR(1) NOT NULL

Note: windmill_id is NOT a FK — records survive windmill deletion by design.
Note: write-only in v1. No read endpoint; not surfaced in the UI.

---

## State Management Architecture

### TanStack Query (REST data)

Managed queries:
- Farms list — includes windmill_count + running_count per farm
- Windmills list — scoped to selectedFarmId
- Windmill detail
- History chart data — per (windmill_id, scale)
- ETL mutations — isPending disables ETL button + shows spinner
- Parquet file list
- Notifications list — fetched on mount, seeded into Zustand once; not re-queried automatically

Query invalidation rules (after each mutation):
| Mutation                     | Queries invalidated                          |
|------------------------------|----------------------------------------------|
| Create windmill              | windmills list, farms list                   |
| Delete windmill              | windmills list, farms list                   |
| Edit windmill (PUT)          | windmills list, windmill detail              |
| Start windmill               | windmills list, farms list                   |
| Stop windmill                | windmills list, farms list                   |
| Farm start/stop              | windmills list, farms list                   |
| ETL (per-windmill)           | history chart data for that windmill_id, parquet file list |
| ETL (farm-level)             | history chart data for all windmills in farm, parquet file list |
| Delete parquet file          | parquet file list                            |
| Create / delete farm         | farms list                                   |

Subsequent SSE events append directly to Zustand — TanStack Query is not involved after initial load.
Manual refresh re-fetches notifications via REST and replaces the Zustand store.

### Zustand (stream + UI state)

selectedFarmId: number | null
selectedWindmillId: string | null
signalsBuffer: SensorReading[] (rolling last 100; cleared on windmill select/deselect)
wsStatus: "idle" | "connecting" | "running" | "stopped" | "error"
notifications: NotificationEntry[] (seeded from TanStack Query on mount; appended by SSE; capped at 500)
modalState: { type: "deleteFarm" | "deleteWindmill", payload: { id: string | number, name: string } } | null
wasRunningBeforeEdit: boolean — set true when edit mode stops a running windmill; cleared on exit
signalsYAxisMode: "auto" | "normalize" | "fixed" — default "auto"; controls Signals chart y-axis
historyYAxisMode: "auto" | "normalize" | "fixed" — default "auto"; controls History chart y-axis

---

## Sensor Value Generation Algorithm

Bounded random walk using per-windmill, user-defined range configuration.
Applies identically to all four sensors: temperature, noise_level, humidity, wind_speed.

Each sensor has four stored boundary values (loaded from the windmills table each loop iteration):
  clamp_min, normal_min, normal_max, spike_max

Algorithm per sensor per reading:
  normal_range = normal_max − normal_min
  Initial seed: last stored value from the in-process registry (persists across stop/start).
    If no stored value (windmill never ran): midpoint = (normal_min + normal_max) / 2.
    After a range change, the stored value may be outside the new range; clamping restores it.
  Delta per step: random value in [−rate% × normal_range, +rate% × normal_range]
    where rate = the sensor's stored rate-of-variation (temp_rate, noise_rate, etc.), default 2.0%
  Hard bounds: value is clamped to [clamp_min, spike_max] after applying the delta
  Spike injection: ~5% probability per reading; value jumps to a random value near spike_max
    (spike_max ± 10% of normal_range); value is then clamped to [clamp_min, spike_max]

Parameter updates: the stream is always stopped before editing (edit mode triggers implicit stop).
On restart after save, the task reads fresh params from DB and seeds sensor values from the registry.

Default sensor ranges (pre-filled in form):
  temperature: [0, 20, 50, 200] °C
  noise_level: [0, 5, 60, 180] dB
  humidity:    [0, 10, 90, 99] %RH
  wind_speed:  [0, 2, 45, 200] km/h

---

## Wire Format Schemas

### Sensor Reading (WebSocket type: "reading" + PostgreSQL)

measurement_timestamp: ISO 8601 (windmill clock)
db_timestamp: ISO 8601 (server clock)
readings.temperature: { value: float, unit: "C" }
readings.noise_level: { value: float, unit: "dB" }
readings.humidity: { value: float, unit: "%RH" }
readings.wind_speed: { value: float, unit: "km/h" }

### beat_unit

ss = seconds | mm = minutes | hh = hours | dd = days
Min: 1 second enforced. Max: 1 day (86400 s) enforced.
Sensor beat and location beat are independent per windmill.

---

## Project Structure

### Frontend (frontend/src/)

src/
domain/ # TypeScript types: Farm, Windmill, SensorReading, Notification, ParquetFile, etc.
infra/ # axios REST client, WebSocket client wrapper, SSE EventSource wrapper
shared/ # error handling utilities, DTOs
components/ # shadcn/ui React components: panels, charts, forms, notifications
pages/ # Single root App page + layout shell

### Backend (backend/)

backend/
domain/ # Pydantic models, business rules, simulation value generator (no FastAPI deps)
infra/ # SQLAlchemy repos, Parquet ETL + reader, JSONL log writer, SSE file tailer
http/ # FastAPI routers, WebSocket handler, SSE handler (thin — no business logic)
shared/ # Error types, shared DTOs

---

## Coding Conventions

### TypeScript (frontend)

- Strict mode: no any, noImplicitAny, strictNullChecks
- Error handling: try/catch — standard JavaScript; no Result<T,E> wrapper
- Functional programming preferred; SOLID when OOP needed
- No global singletons — constructor injection
- JSDoc on every public function
- Co-locate tests: WindmillService.ts -> WindmillService.test.ts
- Vitest

### Python (backend)

- Functional style preferred; classes when state is needed
- FastAPI Depends() for injection — no module-level singletons
- pytest, co-located
- OpenAPI summary + description on every endpoint
- Docstring on every public function

---

## Runtime Conventions

- ./data/ directory (parent of parquet/ and notifications.jsonl) is created automatically by the
  backend on startup if it does not exist. No manual setup required.
- docker-compose.yml at project root: postgres:16, database windmill_scanner, port 5432.
  Default credentials: postgres/postgres (overridable via DATABASE_URL in backend/.env).

---

## Current Phase

DESIGN COMPLETE — all architectural decisions resolved as of 2026-04-24.
No implementation files exist yet. Context is ready for implementation to begin.
