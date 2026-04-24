/**
 * New windmill creation form (inline, expands middle panel).
 *
 * All fields pre-filled with defaults. Discard confirmation if any field changed.
 */
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import type { BeatUnit, LatDir, LonDir } from "../domain/types";
import ConfirmDialog from "./ConfirmDialog";

const DEFAULTS = {
  windmill_id: "",
  name: "",
  description: "",
  sensor_beat: 5,
  sensor_beat_unit: "ss" as BeatUnit,
  location_beat: 1,
  location_beat_unit: "dd" as BeatUnit,
  lat: 0,
  lat_dir: "N" as LatDir,
  lon: 0,
  lon_dir: "E" as LonDir,
  temp_clamp_min: 0, temp_normal_min: 20, temp_normal_max: 50, temp_spike_max: 200,
  noise_clamp_min: 0, noise_normal_min: 5, noise_normal_max: 60, noise_spike_max: 180,
  humidity_clamp_min: 0, humidity_normal_min: 10, humidity_normal_max: 90, humidity_spike_max: 99,
  wind_clamp_min: 0, wind_normal_min: 2, wind_normal_max: 45, wind_spike_max: 200,
  temp_rate: 2.0, noise_rate: 2.0, humidity_rate: 2.0, wind_rate: 2.0,
};

interface Props {
  selectedFarmId: number | null;
  selectedFarmName?: string;
  onClose: () => void;
}

export default function CreateWindmillForm({ selectedFarmId, selectedFarmName, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...DEFAULTS });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscard, setShowDiscard] = useState(false);

  const isDirty =
    form.windmill_id !== DEFAULTS.windmill_id ||
    form.name !== DEFAULTS.name ||
    form.description !== DEFAULTS.description;

  const handleCancel = () => {
    if (isDirty) setShowDiscard(true);
    else onClose();
  };

  const mutation = useMutation({
    mutationFn: (data: typeof DEFAULTS & { farm_id: number }) => api.post("/windmills", data, { skipGlobalErrorHandler: true } as object),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["farms"] });
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } }).response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "";
      if (status === 409) setErrors({ windmill_id: detail });
      if (status === 422) setErrors({ windmill_id: "Invalid windmill_id format." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!selectedFarmId) return;
    mutation.mutate({ ...form, farm_id: selectedFarmId });
  };

  const f = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const isNumeric = e.target.type === "number" || e.target.type === "range";
    const val = isNumeric ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => { const n = { ...prev }; delete n[field as string]; return n; });
  };

  const BEAT_UNITS: BeatUnit[] = ["ss", "mm", "hh", "dd"];
  const BEAT_LABELS: Record<BeatUnit, string> = { ss: "Seconds", mm: "Minutes", hh: "Hours", dd: "Days" };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-700">
          New Wind Turbine in: <span className="text-slate-700">{selectedFarmName ?? "—"}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 panel-scroll p-3 space-y-3">
        {/* Identity */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Identity</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Wind Turbine ID *</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" maxLength={32} value={form.windmill_id} onChange={f("windmill_id")} placeholder="e.g. Turbine_01" />
              {errors.windmill_id && <p className="text-red-500 text-xs mt-0.5">{errors.windmill_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Name *</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" maxLength={60} value={form.name} onChange={f("name")} placeholder="Human-friendly name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Description *</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" maxLength={100} value={form.description} onChange={f("description")} placeholder="Short description" />
            </div>
          </div>
        </section>

        {/* Beats */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timing</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Sensor Beat</label>
              <div className="flex gap-1">
                <input type="number" min={1} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" value={form.sensor_beat} onChange={f("sensor_beat")} />
                <select className="border border-gray-300 rounded px-1 text-sm" value={form.sensor_beat_unit} onChange={f("sensor_beat_unit")}>
                  {BEAT_UNITS.map((u) => <option key={u} value={u}>{BEAT_LABELS[u]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Location Beat</label>
              <div className="flex gap-1">
                <input type="number" min={1} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" value={form.location_beat} onChange={f("location_beat")} />
                <select className="border border-gray-300 rounded px-1 text-sm" value={form.location_beat_unit} onChange={f("location_beat_unit")}>
                  {BEAT_UNITS.map((u) => <option key={u} value={u}>{BEAT_LABELS[u]}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Coordinates */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Location</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Latitude</label>
              <div className="flex gap-1">
                <input type="number" step="any" min={-90} max={90} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" value={form.lat} onChange={f("lat")} />
                <select className="border border-gray-300 rounded px-1 text-sm" value={form.lat_dir} onChange={f("lat_dir")}>
                  <option value="N">N</option><option value="S">S</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Longitude</label>
              <div className="flex gap-1">
                <input type="number" step="any" min={-180} max={180} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" value={form.lon} onChange={f("lon")} />
                <select className="border border-gray-300 rounded px-1 text-sm" value={form.lon_dir} onChange={f("lon_dir")}>
                  <option value="E">E</option><option value="W">W</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Sensor ranges */}
        {(["temp", "noise", "humidity", "wind"] as const).map((sensor) => {
          const labels: Record<string, string> = { temp: "Temperature (°C)", noise: "Noise Level (dB)", humidity: "Humidity (%RH)", wind: "Wind Speed (km/h)" };
          const keys = [`${sensor}_clamp_min`, `${sensor}_normal_min`, `${sensor}_normal_max`, `${sensor}_spike_max`] as (keyof typeof form)[];
          const colLabels = ["Floor", "Sim Min", "Sim Max", "Ceiling"];
          const rate = form[`${sensor}_rate` as keyof typeof form] as number;
          return (
            <section key={sensor}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{labels[sensor]}</h4>
              <div className="grid grid-cols-4 gap-1">
                {keys.map((k, i) => (
                  <div key={k as string}>
                    <label className="block text-[10px] text-gray-500 mb-0.5">{colLabels[i]}</label>
                    <input type="number" step="any" className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs" value={form[k] as number} onChange={f(k)} />
                  </div>
                ))}
              </div>
              <div className="mt-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">±{rate.toFixed(1)}% per beat</label>
                <input type="range" min={0} max={10} step={0.1} className="w-full" value={rate} onChange={f(`${sensor}_rate` as keyof typeof form)} />
              </div>
            </section>
          );
        })}

        {/* Submit */}
        <div className="flex gap-2 pt-2 sticky bottom-0 bg-white py-3 border-t border-gray-100">
          <button type="submit" disabled={!form.windmill_id || !form.name || !form.description || mutation.isPending} className="flex-1 bg-slate-700 text-white text-sm py-2 rounded disabled:opacity-40 hover:bg-slate-800">
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={handleCancel} className="flex-1 border border-gray-300 text-sm py-2 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={showDiscard}
        title="Discard new entry?"
        confirmLabel="Yes, discard"
        cancelLabel="No, go back"
        onConfirm={() => { setShowDiscard(false); onClose(); }}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
}
