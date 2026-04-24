/**
 * Inline windmill edit form (replaces list in the middle panel).
 *
 * - Save disabled until at least one field differs from loaded values.
 * - Cancel with no changes: close immediately (auto-restart if wasRunningBeforeEdit).
 * - Cancel with changes: show discard confirmation.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import type { Windmill, BeatUnit, LatDir, LonDir } from "../domain/types";
import ConfirmDialog from "./ConfirmDialog";
import { useStore } from "../store/useStore";

interface Props {
  windmillId: string;
  onClose: (restart: boolean) => void;
}

type FormData = Omit<Windmill, "id" | "windmill_id" | "farm_id" | "is_running" | "created_at">;

function toFormData(wm: Windmill): FormData {
  return {
    name: wm.name, description: wm.description,
    sensor_beat: wm.sensor_beat, sensor_beat_unit: wm.sensor_beat_unit,
    location_beat: wm.location_beat, location_beat_unit: wm.location_beat_unit,
    lat: wm.lat, lat_dir: wm.lat_dir, lon: wm.lon, lon_dir: wm.lon_dir,
    temp_clamp_min: wm.temp_clamp_min, temp_normal_min: wm.temp_normal_min, temp_normal_max: wm.temp_normal_max, temp_spike_max: wm.temp_spike_max,
    noise_clamp_min: wm.noise_clamp_min, noise_normal_min: wm.noise_normal_min, noise_normal_max: wm.noise_normal_max, noise_spike_max: wm.noise_spike_max,
    humidity_clamp_min: wm.humidity_clamp_min, humidity_normal_min: wm.humidity_normal_min, humidity_normal_max: wm.humidity_normal_max, humidity_spike_max: wm.humidity_spike_max,
    wind_clamp_min: wm.wind_clamp_min, wind_normal_min: wm.wind_normal_min, wind_normal_max: wm.wind_normal_max, wind_spike_max: wm.wind_spike_max,
    temp_rate: wm.temp_rate, noise_rate: wm.noise_rate, humidity_rate: wm.humidity_rate, wind_rate: wm.wind_rate,
  };
}

export default function EditWindmillForm({ windmillId, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData | null>(null);
  const [original, setOriginal] = useState<FormData | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const wasRunningBeforeEdit = useStore((s) => s.wasRunningBeforeEdit);

  const { data: windmill } = useQuery<Windmill>({
    queryKey: ["windmill", windmillId],
    queryFn: () => api.get<Windmill>(`/windmills/${windmillId}`).then((r) => r.data),
  });

  useEffect(() => {
    if (windmill && !form) {
      const fd = toFormData(windmill);
      setForm(fd);
      setOriginal(fd);
    }
  }, [windmill]);

  const isDirty = form && original
    ? JSON.stringify(form) !== JSON.stringify(original)
    : false;

  const saveMutation = useMutation({
    mutationFn: (data: Partial<FormData>) => api.put(`/windmills/${windmillId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windmills"] });
      qc.invalidateQueries({ queryKey: ["windmill", windmillId] });
      onClose(true); // restart if wasRunningBeforeEdit
    },
  });

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscard(true);
    } else {
      onClose(true); // auto-restart even on cancel with no changes
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !isDirty) return;
    saveMutation.mutate(form);
  };

  const f = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const isNumeric = e.target.type === "number" || e.target.type === "range";
    const val = isNumeric ? Number(e.target.value) : e.target.value;
    setForm((prev) => prev ? { ...prev, [field]: val } : prev);
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const BEAT_UNITS: BeatUnit[] = ["ss", "mm", "hh", "dd"];
  const BEAT_LABELS: Record<BeatUnit, string> = { ss: "Seconds", mm: "Minutes", hh: "Hours", dd: "Days" };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-700">Edit: {windmillId}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 panel-scroll p-3 space-y-3">
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Details</h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Name</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" maxLength={60} value={form.name} onChange={f("name")} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Description</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm" maxLength={100} value={form.description} onChange={f("description")} />
            </div>
          </div>
        </section>

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

        {(["temp", "noise", "humidity", "wind"] as const).map((sensor) => {
          const labels: Record<string, string> = { temp: "Temperature (°C)", noise: "Noise Level (dB)", humidity: "Humidity (%RH)", wind: "Wind Speed (km/h)" };
          const keys = [`${sensor}_clamp_min`, `${sensor}_normal_min`, `${sensor}_normal_max`, `${sensor}_spike_max`] as (keyof FormData)[];
          const colLabels = ["Floor", "Sim Min", "Sim Max", "Ceiling"];
          const rate = form[`${sensor}_rate` as keyof FormData] as number;
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
                <input type="range" min={0} max={10} step={0.1} className="w-full" value={rate} onChange={f(`${sensor}_rate` as keyof FormData)} />
              </div>
            </section>
          );
        })}

        <div className="flex gap-2 pt-2 sticky bottom-0 bg-white py-3 border-t border-gray-100">
          <button type="submit" disabled={!isDirty || saveMutation.isPending} className="flex-1 bg-slate-700 text-white text-sm py-2 rounded disabled:opacity-40 hover:bg-slate-800">
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={handleCancel} className="flex-1 border border-gray-300 text-sm py-2 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={showDiscard}
        title="Discard changes?"
        confirmLabel="Yes, discard"
        cancelLabel="No, go back"
        onConfirm={() => { setShowDiscard(false); onClose(true); }}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
}
