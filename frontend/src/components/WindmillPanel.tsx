/**
 * Middle panel: Windmill Management.
 *
 * Windmill list → inline edit form → creation form (expands panel).
 * Control bar: Start / Stop / Edit / Delete / ETL.
 * Farm-level ETL button in panel header.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import type { Windmill, Farm } from "../domain/types";
import { formatBeat } from "../domain/types";
import { useStore } from "../store/useStore";
import ConfirmDialog from "./ConfirmDialog";
import CreateWindmillForm from "./CreateWindmillForm";
import EditWindmillForm from "./EditWindmillForm";

// ─── Windmill list row ────────────────────────────────────────────────────────

function WindmillRow({
  wm,
  selected,
  onClick,
}: {
  wm: Windmill;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li
      onClick={onClick}
      title={wm.description}
      className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
        selected ? "bg-slate-50 border-l-2 border-l-slate-600" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{wm.name}</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            wm.is_running ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {wm.is_running ? "running" : "stopped"}
        </span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{wm.windmill_id}</div>
      <div className="text-xs text-gray-500 mt-0.5">
        sensor: {formatBeat(wm.sensor_beat, wm.sensor_beat_unit)} &middot;
        loc: {formatBeat(wm.location_beat, wm.location_beat_unit)}
      </div>
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type PanelMode = "list" | "create" | "edit";

export default function WindmillPanel() {
  const qc = useQueryClient();
  const {
    selectedFarmId, selectedWindmillId, selectWindmill,
    openModal, closeModal, modalState,
    wasRunningBeforeEdit, setWasRunningBeforeEdit,
  } = useStore();

  const [mode, setMode] = useState<PanelMode>("list");
  const [farmEtlConfirm, setFarmEtlConfirm] = useState(false);
  const [windmillEtlConfirm, setWindmillEtlConfirm] = useState(false);

  // Farms (for name display in header/form)
  const { data: farms } = useQuery<Farm[]>({ queryKey: ["farms"], queryFn: () => api.get<Farm[]>("/farms").then((r) => r.data) });
  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);

  // Windmills
  const { data: windmills, isLoading, isError } = useQuery<Windmill[]>({
    queryKey: ["windmills", selectedFarmId],
    queryFn: () => api.get<Windmill[]>(`/farms/${selectedFarmId}/windmills`).then((r) => r.data),
    enabled: !!selectedFarmId,
  });
  const selectedWindmill = windmills?.find((w) => w.windmill_id === selectedWindmillId);

  // Control mutations
  const startMutation = useMutation({
    mutationFn: () => api.post(`/windmills/${selectedWindmillId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["farms"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post(`/windmills/${selectedWindmillId}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["farms"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/windmills/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["farms"] });
      selectWindmill(null);
      closeModal();
    },
  });

  const etlMutation = useMutation({
    mutationFn: (id: string) => api.post(`/windmills/${id}/etl`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history", selectedWindmillId] });
      qc.invalidateQueries({ queryKey: ["parquet-files"] });
      setWindmillEtlConfirm(false);
    },
  });

  const farmEtlMutation = useMutation({
    mutationFn: (farmId: number) => api.post(`/farms/${farmId}/etl`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["parquet-files"] });
      setFarmEtlConfirm(false);
    },
  });

  const openCreate = () => {
    setMode("create");
  };
  const closeCreate = () => {
    setMode("list");
  };

  const openEdit = () => {
    // If running, stop stream first
    if (selectedWindmill?.is_running) {
      setWasRunningBeforeEdit(true);
      api.post(`/windmills/${selectedWindmillId}/stop`).then(() => {
        qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
        qc.invalidateQueries({ queryKey: ["farms"] });
      });
    } else {
      setWasRunningBeforeEdit(false);
    }
    setMode("edit");
  };

  const closeEdit = async (restart: boolean) => {
    setMode("list");
    if (restart && wasRunningBeforeEdit && selectedWindmillId) {
      await api.post(`/windmills/${selectedWindmillId}/start`);
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["farms"] });
    }
    setWasRunningBeforeEdit(false);
  };

  if (mode === "create") {
    return (
      <CreateWindmillForm
        selectedFarmId={selectedFarmId}
        selectedFarmName={selectedFarm?.name}
        onClose={closeCreate}
      />
    );
  }

  if (mode === "edit" && selectedWindmillId) {
    return (
      <EditWindmillForm
        windmillId={selectedWindmillId}
        onClose={closeEdit}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Wind Turbine Management</span>
        <div className="flex gap-1">
          <button
            disabled={!selectedFarmId || farmEtlMutation.isPending}
            title={
              !selectedFarmId
                ? "Select a farm first."
                : farmEtlMutation.isPending
                ? "ETL in progress…"
                : `Move all signals per wind turbine in this wind park from the database to parquet (archive) files.`
            }
            onClick={() => setFarmEtlConfirm(true)}
            className="text-xs border border-gray-300 px-2 py-0.5 rounded hover:bg-gray-50 disabled:opacity-40"
          >
            {farmEtlMutation.isPending ? "…ETL" : "Farm ETL"}
          </button>
          <button
            disabled={!selectedFarmId}
            title={!selectedFarmId ? "A wind park must be first selected." : "Create a new wind turbine."}
            onClick={openCreate}
            className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded hover:bg-slate-800 disabled:opacity-40"
          >
            New Wind Turbine
          </button>
        </div>
      </div>

      {/* Windmill list */}
      <div className="flex-1 panel-scroll min-h-0">
        {!selectedFarmId ? (
          <p className="text-sm text-gray-400 text-center mt-8">Select a wind park to view its wind turbines.</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-sm text-gray-500 text-center mt-8">Failed to load windmills.</p>
        ) : !windmills || windmills.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">
            No wind turbines in this wind park. Click 'New Wind Turbine' to add one.
          </p>
        ) : (
          <ul>
            {windmills.map((wm) => (
              <WindmillRow
                key={wm.windmill_id}
                wm={wm}
                selected={wm.windmill_id === selectedWindmillId}
                onClick={() => {
                  if (wm.windmill_id !== selectedWindmillId) selectWindmill(wm.windmill_id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Control bar */}
      <div className="shrink-0 flex gap-1 p-2 border-t border-gray-200 bg-gray-50">
        <button
          disabled={!selectedWindmillId || selectedWindmill?.is_running || startMutation.isPending}
          onClick={() => startMutation.mutate()}
          className="flex-1 text-xs py-1.5 bg-green-600 text-white rounded disabled:opacity-40 hover:bg-green-700"
        >
          Start
        </button>
        <button
          disabled={!selectedWindmillId || !selectedWindmill?.is_running || stopMutation.isPending}
          onClick={() => stopMutation.mutate()}
          className="flex-1 text-xs py-1.5 bg-amber-500 text-white rounded disabled:opacity-40 hover:bg-amber-600"
        >
          Stop
        </button>
        <button
          disabled={!selectedWindmillId}
          onClick={openEdit}
          className="flex-1 text-xs py-1.5 bg-slate-600 text-white rounded disabled:opacity-40 hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          disabled={!selectedWindmillId || selectedWindmill?.is_running}
          onClick={() =>
            selectedWindmill &&
            openModal({
              type: "deleteWindmill",
              payload: { id: selectedWindmill.windmill_id, name: selectedWindmill.name },
            })
          }
          className="flex-1 text-xs py-1.5 bg-red-600 text-white rounded disabled:opacity-40 hover:bg-red-700"
        >
          Delete
        </button>
        <button
          disabled={!selectedWindmillId || etlMutation.isPending}
          title={
            etlMutation.isPending
              ? "ETL in progress…"
              : selectedWindmillId
              ? `Move signals for this wind turbine from the database to its parquet (archive) file.`
              : ""
          }
          onClick={() => setWindmillEtlConfirm(true)}
          className="flex-1 text-xs py-1.5 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100"
        >
          {etlMutation.isPending ? "…" : "ETL"}
        </button>
      </div>

      {/* Delete windmill dialog */}
      {modalState?.type === "deleteWindmill" && (
        <ConfirmDialog
          open
          title={`Delete "${modalState.payload.name}"?`}
          body="Are you sure you want to delete this wind turbine? This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={() => deleteMutation.mutate(modalState.payload.id)}
          onCancel={closeModal}
        />
      )}

      {/* ETL windmill dialog */}
      {windmillEtlConfirm && selectedWindmill && (
        <ConfirmDialog
          open
          title={`Run ETL for ${selectedWindmill.name}?`}
          body="This will archive all new sensor readings for this wind turbine to the Parquet file."
          confirmLabel="Archive"
          cancelLabel="Cancel"
          onConfirm={() => etlMutation.mutate(selectedWindmill.windmill_id)}
          onCancel={() => setWindmillEtlConfirm(false)}
        />
      )}

      {/* ETL farm dialog */}
      {farmEtlConfirm && selectedFarm && (
        <ConfirmDialog
          open
          title={`Run ETL for all wind turbines in ${selectedFarm.name}?`}
          body="This will archive all new sensor readings for all wind turbines to their Parquet files."
          confirmLabel="Archive"
          cancelLabel="Cancel"
          onConfirm={() => farmEtlMutation.mutate(selectedFarm.id)}
          onCancel={() => setFarmEtlConfirm(false)}
        />
      )}
    </div>
  );
}
