/**
 * Real-time signals chart (WebSocket).
 *
 * 4 coloured lines on a shared y-axis. Rolling 100 readings.
 * Y-axis mode combobox. Overlays for connecting/stopped/error states.
 */
import { useStore } from "../store/useStore";
import type { Windmill, YAxisMode } from "../domain/types";
import { useQuery } from "@tanstack/react-query";
import api from "../infra/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const SENSORS = [
  { key: "temperature", color: "#ef4444", label: "Temperature" },
  { key: "noise_level", color: "#f97316", label: "Noise Level" },
  { key: "humidity", color: "#3b82f6", label: "Humidity" },
  { key: "wind_speed", color: "#22c55e", label: "Wind Speed" },
] as const;

function formatTs(ts: string): string {
  return new Date(ts).toISOString().slice(11, 19);
}

function YAxisModeSelect({ mode, onChange }: { mode: YAxisMode; onChange: (m: YAxisMode) => void }) {
  return (
    <select
      value={mode}
      onChange={(e) => onChange(e.target.value as YAxisMode)}
      className="text-xs border border-gray-300 rounded px-1 py-0.5"
    >
      <option value="auto">Auto-scale</option>
      <option value="normalize">Normalize 0–100%</option>
      <option value="fixed">Fixed domain</option>
    </select>
  );
}

export default function SignalsChart() {
  const {
    selectedWindmillId, signalsBuffer, wsStatus,
    signalsYAxisMode, setSignalsYAxisMode, selectWindmill,
  } = useStore();

  const { data: windmill } = useQuery<Windmill>({
    queryKey: ["windmill", selectedWindmillId],
    queryFn: () => api.get<Windmill>(`/windmills/${selectedWindmillId}`).then((r) => r.data),
    enabled: !!selectedWindmillId,
  });

  const handleReconnect = () => {
    if (!selectedWindmillId) return;
    // Re-trigger WS by briefly deselecting then reselecting
    const id = selectedWindmillId;
    selectWindmill(null);
    setTimeout(() => selectWindmill(id), 100);
  };

  // Compute chart data with optional normalization
  const chartData = signalsBuffer.map((r) => {
    const ts = formatTs(r.measurement_timestamp);
    if (signalsYAxisMode === "normalize" && windmill) {
      return {
        ts,
        temperature: ((r.temperature - windmill.temp_clamp_min) / (windmill.temp_spike_max - windmill.temp_clamp_min)) * 100,
        noise_level: ((r.noise_level - windmill.noise_clamp_min) / (windmill.noise_spike_max - windmill.noise_clamp_min)) * 100,
        humidity: ((r.humidity - windmill.humidity_clamp_min) / (windmill.humidity_spike_max - windmill.humidity_clamp_min)) * 100,
        wind_speed: ((r.wind_speed - windmill.wind_clamp_min) / (windmill.wind_spike_max - windmill.wind_clamp_min)) * 100,
      };
    }
    return { ts, temperature: r.temperature, noise_level: r.noise_level, humidity: r.humidity, wind_speed: r.wind_speed };
  });

  const yDomain: [number | "auto" | "dataMin", number | "auto" | "dataMax"] =
    signalsYAxisMode === "normalize"
      ? [0, 100]
      : signalsYAxisMode === "fixed" && windmill
      ? [
          Math.min(windmill.temp_clamp_min, windmill.noise_clamp_min, windmill.humidity_clamp_min, windmill.wind_clamp_min),
          Math.max(windmill.temp_spike_max, windmill.noise_spike_max, windmill.humidity_spike_max, windmill.wind_spike_max),
        ]
      : ["auto", "auto"];

  const stopped = wsStatus === "stopped";
  const error = wsStatus === "error";
  const connecting = wsStatus === "connecting";
  const lineStroke = (stopped || error) ? "#9ca3af" : undefined;

  return (
    <div className="flex flex-col h-full bg-white p-2">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Signals (Real-Time)</span>
        <YAxisModeSelect mode={signalsYAxisMode} onChange={setSignalsYAxisMode} />
      </div>

      <div className="flex-1 relative min-h-0">
        {!selectedWindmillId ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Select a windmill to view data
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ts" tick={{ fontSize: 10 }} />
                <YAxis domain={yDomain} tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {SENSORS.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={lineStroke ?? s.color}
                    dot={false}
                    isAnimationActive={false}
                    name={s.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Overlays */}
            {connecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
                <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-sm text-gray-500">Connecting…</span>
              </div>
            )}
            {stopped && (
              <div className="absolute top-2 right-2 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded">
                Stream Stopped
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
                <span className="text-sm text-red-500 mb-2">Connection Error</span>
                <button
                  onClick={handleReconnect}
                  className="text-xs bg-slate-700 text-white px-3 py-1.5 rounded hover:bg-slate-800"
                >
                  Reconnect
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
