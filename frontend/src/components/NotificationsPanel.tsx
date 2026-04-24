/**
 * Bottom panel: Notifications.
 *
 * Seeded from REST on mount; updated in real-time via SSE.
 * Manual refresh, clear button, SSE disconnect indicator.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import { useStore } from "../store/useStore";
import type { NotificationEntry } from "../domain/types";

function formatTime(ts: string): string {
  return new Date(ts).toISOString().slice(11, 19);
}

function EntryRow({ entry }: { entry: NotificationEntry }) {
  const time = formatTime(entry.timestamp);
  const full = `${entry.timestamp} | ${entry.level} | ${entry.entity_type}/${entry.entity_id ?? "-"} | ${entry.message}`;
  const isError = entry.level === "error";
  return (
    <div
      title={full}
      className={`px-3 py-1 text-xs border-b border-gray-100 truncate ${
        isError ? "bg-red-50 text-red-700" : "text-gray-700"
      }`}
    >
      <span className="text-gray-400 mr-2">{time}</span>
      {entry.message}
    </div>
  );
}

export default function NotificationsPanel() {
  const { notifications, clearNotifications, sseConnected, seedNotifications } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const qc = useQueryClient();

  const handleRefresh = async () => {
    setRefreshing(true);
    setFetchError(false);
    try {
      const data = await api.get<NotificationEntry[]>("/notifications").then((r) => r.data);
      seedNotifications(data);
      qc.setQueryData(["notifications"], data);
    } catch {
      setFetchError(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-t border-gray-200">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Notifications</span>
          {!sseConnected && (
            <span className="text-xs text-amber-500" title="SSE stream disconnected">
              ⚠ disconnected
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? "…" : "Refresh"}
          </button>
          <button
            onClick={clearNotifications}
            className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 panel-scroll min-h-0">
        {fetchError && (
          <p className="text-xs text-red-500 px-3 py-2">Failed to load notifications.</p>
        )}
        {notifications.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-4">No notifications yet.</p>
        ) : (
          notifications.map((n, i) => <EntryRow key={i} entry={n} />)
        )}
      </div>
    </div>
  );
}
