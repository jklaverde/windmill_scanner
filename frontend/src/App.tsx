/**
 * Root layout: fixed-viewport 4-row design.
 *
 * Row 1: title bar (~3rem)
 * Row 2: three panels (~35% of remaining)
 * Row 3: two charts (~35% of remaining)
 * Row 4: notifications (remainder)
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "./store/useStore";
import { NotificationSSE } from "./infra/sse";
import { WindmillWebSocket } from "./infra/ws";
import api from "./infra/api";
import type { WsMessage, SensorReading, NotificationEntry } from "./domain/types";

import AboutModal from "./components/AboutModal";
import FarmPanel from "./components/FarmPanel";
import WindmillPanel from "./components/WindmillPanel";
import ParquetPanel from "./components/ParquetPanel";
import SignalsChart from "./components/SignalsChart";
import HistoryChart from "./components/HistoryChart";
import NotificationsPanel from "./components/NotificationsPanel";

export default function App() {
  const [showAbout, setShowAbout] = useState(false);
  const {
    selectedWindmillId,
    pushReading,
    setWsStatus,
    seedNotifications,
    addNotification,
    setSseConnected,
    setWindmillAnomaly,
  } = useStore();

  // ── Seed notifications on mount ──────────────────────────────────────────
  const { data: initialNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationEntry[]>("/notifications").then((r) => r.data),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (initialNotifications) seedNotifications(initialNotifications);
  }, [initialNotifications, seedNotifications]);

  // ── ML health polling ─────────────────────────────────────────────────────
  // Uses native fetch (not the axios instance) so failures are silent — no toast.
  // Always resolves: returns { model_loaded: false } on any error or non-2xx.
  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
  const { data: mlHealth } = useQuery({
    queryKey: ["anomaly-health"],
    queryFn: async (): Promise<{ model_loaded: boolean }> => {
      try {
        const r = await fetch(`${BASE_URL}/anomaly/health`, { cache: "no-store" });
        if (!r.ok) return { model_loaded: false };
        return await r.json();
      } catch {
        return { model_loaded: false };
      }
    },
    refetchInterval: 30_000,
  });
  const mlOk = mlHealth?.model_loaded === true;

  // ── SSE ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sse = new NotificationSSE(
      (entry) => addNotification(entry),
      (connected) => setSseConnected(connected),
    );
    sse.connect();
    return () => sse.destroy();
  }, [addNotification, setSseConnected]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const wsRef = useRef<WindmillWebSocket | null>(null);

  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new WindmillWebSocket(
        (msg: WsMessage) => {
          if (msg.type === "reading") {
            const r: SensorReading = {
              measurement_timestamp: msg.measurement_timestamp,
              temperature: msg.readings.temperature.value,
              noise_level: msg.readings.noise_level.value,
              humidity: msg.readings.humidity.value,
              wind_speed: msg.readings.wind_speed.value,
              potential_anomaly: msg.anomaly?.potential_anomaly ?? null,
              anomaly_probability: msg.anomaly?.probability ?? null,
            };
            pushReading(r);
            if (msg.anomaly?.potential_anomaly === true) {
              setWindmillAnomaly(msg.windmill_id, true);
            }
          } else if (msg.type === "status") {
            setWsStatus(msg.status === "started" ? "running" : "stopped");
          }
        },
        (status) => setWsStatus(status),
      );
    }
  }, [pushReading, setWsStatus]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (selectedWindmillId) {
      ws.connect(selectedWindmillId);
    } else {
      ws.destroy();
    }
  }, [selectedWindmillId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Row 1: Title bar */}
      <header className="flex-none h-12 bg-slate-800 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Wind turbine icon */}
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M15.2 14.5 L14.2 27.5 H17.8 L16.8 14.5 Z" fill="#94a3b8"/>
            <path d="M16 13 C14.6 11 14 8 16 4.5 C18 8 17.4 11 16 13Z" fill="white" transform="rotate(0   16 13)"/>
            <path d="M16 13 C14.6 11 14 8 16 4.5 C18 8 17.4 11 16 13Z" fill="white" transform="rotate(120 16 13)"/>
            <path d="M16 13 C14.6 11 14 8 16 4.5 C18 8 17.4 11 16 13Z" fill="white" transform="rotate(240 16 13)"/>
            <circle cx="16" cy="13" r="2.2" fill="white"/>
          </svg>
          <span className="text-sm font-semibold tracking-wide">Wind Turbine Simulator (International University - IU)</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              mlOk ? "bg-green-700 text-green-100" : "bg-red-700 text-red-100"
            }`}
            title={mlOk ? "ML anomaly service is running." : "ML anomaly service is unreachable."}
          >
            {mlOk ? "ML OK" : "ML unreachable"}
          </span>
          <button
            onClick={() => setShowAbout(true)}
            className="text-xs text-slate-300 border border-slate-600 px-3 py-1 rounded hover:bg-slate-700 hover:text-white transition-colors"
          >
            About
          </button>
        </div>
      </header>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Row 2: Three panels */}
      <div className="flex min-h-0 border-b border-gray-200" style={{ flex: "35 0 0" }}>
        <div className="flex-1 min-w-0 border-r border-gray-200">
          <FarmPanel />
        </div>
        <div className="flex-1 min-w-0">
          <WindmillPanel />
        </div>
        <div className="flex-1 min-w-0 border-l border-gray-200">
          <ParquetPanel />
        </div>
      </div>

      {/* Row 3: Two charts */}
      <div className="flex min-h-0 border-b border-gray-200" style={{ flex: "35 0 0" }}>
        <div className="flex-1 min-w-0 border-r border-gray-200">
          <SignalsChart />
        </div>
        <div className="flex-1 min-w-0">
          <HistoryChart />
        </div>
      </div>

      {/* Row 4: Notifications */}
      <div className="flex-1 min-h-0">
        <NotificationsPanel />
      </div>
    </div>
  );
}
