/** All TypeScript domain types for the Windmill Scanner application. */

export interface Farm {
  id: number;
  name: string;
  description: string;
  windmill_count: number;
  running_count: number;
  has_anomaly: boolean;
  created_at: string;
}

export interface Windmill {
  id: number;
  windmill_id: string;
  name: string;
  description: string;
  farm_id: number;
  is_running: boolean;
  sensor_beat: number;
  sensor_beat_unit: BeatUnit;
  location_beat: number;
  location_beat_unit: BeatUnit;
  lat: number;
  lat_dir: LatDir;
  lon: number;
  lon_dir: LonDir;
  temp_clamp_min: number;
  temp_normal_min: number;
  temp_normal_max: number;
  temp_spike_max: number;
  noise_clamp_min: number;
  noise_normal_min: number;
  noise_normal_max: number;
  noise_spike_max: number;
  humidity_clamp_min: number;
  humidity_normal_min: number;
  humidity_normal_max: number;
  humidity_spike_max: number;
  wind_clamp_min: number;
  wind_normal_min: number;
  wind_normal_max: number;
  wind_spike_max: number;
  temp_rate: number;
  noise_rate: number;
  humidity_rate: number;
  wind_rate: number;
  created_at: string;
  latest_anomaly: boolean | null;
}

export type BeatUnit = "ss" | "mm" | "hh" | "dd";
export type LatDir = "N" | "S";
export type LonDir = "E" | "W";

export interface SensorReading {
  measurement_timestamp: string;
  temperature: number;
  noise_level: number;
  humidity: number;
  wind_speed: number;
  potential_anomaly?: boolean | null;
  anomaly_probability?: number | null;
}

export interface WsReading {
  type: "reading";
  windmill_id: string;
  measurement_timestamp: string;
  db_timestamp: string;
  readings: {
    temperature: { value: number; unit: string };
    noise_level: { value: number; unit: string };
    humidity: { value: number; unit: string };
    wind_speed: { value: number; unit: string };
  };
  anomaly: { potential_anomaly: boolean; probability: number } | null;
}

export interface WsStatus {
  type: "status";
  status: "started" | "stopped";
  windmill_id: string;
  message: string;
}

export interface WsError {
  type: "error";
  message: string;
}

export type WsMessage = WsReading | WsStatus | WsError;

export interface NotificationEntry {
  timestamp: string;
  level: "info" | "error";
  message: string;
  entity_type: "farm" | "windmill" | "system";
  entity_id: string | null;
}

export interface ParquetFile {
  windmill_id: string;
  size_bytes: number;
  modified_at: string;
  first_timestamp: string | null;
  last_timestamp: string | null;
  in_use: boolean;
}

export type WsConnectionStatus = "idle" | "connecting" | "running" | "stopped" | "error";
export type HistoryScale = "minute" | "hour" | "day" | "week";
export type YAxisMode = "auto" | "normalize" | "fixed";

export type ModalState =
  | { type: "deleteFarm"; payload: { id: number; name: string } }
  | { type: "deleteWindmill"; payload: { id: string; name: string } }
  | { type: "confirmEtlWindmill"; payload: { windmill_id: string; windmill_name: string } }
  | { type: "confirmEtlFarm"; payload: { farm_id: number; farm_name: string } }
  | null;

/** Compact beat unit display: ss→s, mm→m, hh→h, dd→d */
export function formatBeat(beat: number, unit: BeatUnit): string {
  const labels: Record<BeatUnit, string> = { ss: "s", mm: "m", hh: "h", dd: "d" };
  return `${beat}${labels[unit]}`;
}
