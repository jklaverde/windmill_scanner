/**
 * Root layout: fixed-viewport 4-row design.
 *
 * Row 1: title bar (~3rem)
 * Row 2: three panels (~35% of remaining)
 * Row 3: two charts (~35% of remaining)
 * Row 4: notifications (remainder)
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "./store/useStore";
import { NotificationSSE } from "./infra/sse";
import { WindmillWebSocket } from "./infra/ws";
import api from "./infra/api";
import type { WsMessage, SensorReading, NotificationEntry } from "./domain/types";

import FarmPanel from "./components/FarmPanel";
import WindmillPanel from "./components/WindmillPanel";
import ParquetPanel from "./components/ParquetPanel";
import SignalsChart from "./components/SignalsChart";
import HistoryChart from "./components/HistoryChart";
import NotificationsPanel from "./components/NotificationsPanel";

export default function App() {
  const {
    selectedWindmillId,
    isCreatingWindmill,
    pushReading,
    setWsStatus,
    seedNotifications,
    addNotification,
    setSseConnected,
    wsStatus,
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
            };
            pushReading(r);
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

  // Collapse side panels while creating a windmill
  const sidePanelClass = isCreatingWindmill ? "hidden" : "flex-1 min-w-0";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Row 1: Title bar */}
      <header className="flex-none h-12 bg-slate-800 text-white flex items-center px-4 text-sm font-semibold tracking-wide shrink-0">
        Windmill Data Stream Simulator (IU)
      </header>

      {/* Row 2: Three panels */}
      <div className="flex min-h-0 border-b border-gray-200" style={{ flex: "35 0 0" }}>
        <div className={`${sidePanelClass} border-r border-gray-200`}>
          <FarmPanel />
        </div>
        <div className="flex-1 min-w-0">
          <WindmillPanel />
        </div>
        <div className={`${sidePanelClass} border-l border-gray-200`}>
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
