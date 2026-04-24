/**
 * Historical data chart (Parquet-backed).
 *
 * Time-scale selector (minute/hour/day/week). Y-axis mode combobox.
 * All scales read from Parquet — ETL must have been run for data to appear.
 */
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from "../infra/api";
import { useStore } from "../store/useStore";
import type { SensorReading, Windmill, HistoryScale, YAxisMode } from "../domain/types";

const SENSORS = [
  { key: "temperature", color: "#ef4444", label: "Temperature" },
  { key: "noise_level", color: "#f97316", label: "Noise Level" },
  { key: "humidity", color: "#3b82f6", label: "Humidity" },
  { key: "wind_speed", color: "#22c55e", label: "Wind Speed" },
] as const;

function formatTs(ts: string, scale: HistoryScale): string {
  const d = new Date(ts);
  if (scale === "minute" || scale === "hour") return d.toISOString().slice(11, 19);
  if (scale === "day") return d.toISOString().slice(11, 16);
  // week
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()} ${d.toISOString().slice(11, 16)}`;
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

export default function HistoryChart() {
  const {
    selectedWindmillId, historyScale, setHistoryScale,
    historyYAxisMode, setHistoryYAxisMode,
  } = useStore();

  const { data: windmill } = useQuery<Windmill>({
    queryKey: ["windmill", selectedWindmillId],
    queryFn: () => api.get<Windmill>(`/windmills/${selectedWindmillId}`).then((r) => r.data),
    enabled: !!selectedWindmillId,
  });

  const { data: history, isLoading } = useQuery<SensorReading[]>({
    queryKey: ["history", selectedWindmillId, historyScale],
    queryFn: () =>
      api.get<SensorReading[]>(`/windmills/${selectedWindmillId}/history?scale=${historyScale}`).then((r) => r.data),
    enabled: !!selectedWindmillId,
  });

  const chartData = (history ?? []).map((r) => ({
    ts: formatTs(r.measurement_timestamp, historyScale),
    temperature:
      historyYAxisMode === "normalize" && windmill
        ? ((r.temperature - windmill.temp_clamp_min) / (windmill.temp_spike_max - windmill.temp_clamp_min)) * 100
        : r.temperature,
    noise_level:
      historyYAxisMode === "normalize" && windmill
        ? ((r.noise_level - windmill.noise_clamp_min) / (windmill.noise_spike_max - windmill.noise_clamp_min)) * 100
        : r.noise_level,
    humidity:
      historyYAxisMode === "normalize" && windmill
        ? ((r.humidity - windmill.humidity_clamp_min) / (windmill.humidity_spike_max - windmill.humidity_clamp_min)) * 100
        : r.humidity,
    wind_speed:
      historyYAxisMode === "normalize" && windmill
        ? ((r.wind_speed - windmill.wind_clamp_min) / (windmill.wind_spike_max - windmill.wind_clamp_min)) * 100
        : r.wind_speed,
  }));

  const yDomain: [number | "auto" | "dataMin", number | "auto" | "dataMax"] =
    historyYAxisMode === "normalize"
      ? [0, 100]
      : historyYAxisMode === "fixed" && windmill
      ? [
          Math.min(windmill.temp_clamp_min, windmill.noise_clamp_min, windmill.humidity_clamp_min, windmill.wind_clamp_min),
          Math.max(windmill.temp_spike_max, windmill.noise_spike_max, windmill.humidity_spike_max, windmill.wind_spike_max),
        ]
      : ["auto", "auto"];

  const SCALES: HistoryScale[] = ["minute", "hour", "day", "week"];

  return (
    <div className="flex flex-col h-full bg-white p-2">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">History</span>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-gray-300 overflow-hidden text-xs">
            {SCALES.map((s) => (
              <button
                key={s}
                onClick={() => setHistoryScale(s)}
                className={`px-2 py-0.5 ${historyScale === s ? "bg-slate-700 text-white" : "hover:bg-gray-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <YAxisModeSelect mode={historyYAxisMode} onChange={setHistoryYAxisMode} />
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        {!selectedWindmillId ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Select a windmill to view data
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            No data available for this time range
          </div>
        ) : (
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
                  stroke={s.color}
                  dot={false}
                  isAnimationActive={false}
                  name={s.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
