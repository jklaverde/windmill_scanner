/**
 * Left panel: Farm Management.
 *
 * - Scrollable farm list sorted A→Z with windmill counts (traffic-light icons).
 * - Inline "New Farm" creation form (toggled).
 * - Fixed bottom control bar: Start All / Stop All / Delete.
 * - All loading, empty, error, and discard-confirmation states.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../infra/api";
import type { Farm } from "../domain/types";
import { useStore } from "../store/useStore";
import ConfirmDialog from "./ConfirmDialog";

// ─── API calls ───────────────────────────────────────────────────────────────

const fetchFarms = () => api.get<Farm[]>("/farms").then((r) => r.data);

// ─── Sub-components ──────────────────────────────────────────────────────────

interface NewFarmFormProps {
  onClose: () => void;
}

function NewFarmForm({ onClose }: NewFarmFormProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [showDiscard, setShowDiscard] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post("/farms", data, { skipGlobalErrorHandler: true } as object),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } }).response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "";
      if (status === 409) setNameError(detail);
    },
  });

  const handleCancel = () => {
    if (name || description) {
      setShowDiscard(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    if (!name.trim() || !description.trim()) return;
    mutation.mutate({ name: name.trim(), description: description.trim() });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 bg-gray-50 space-y-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            maxLength={60}
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(""); }}
            placeholder="Farm name"
          />
          {nameError && <p className="text-red-500 text-xs mt-0.5">{nameError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
          <input
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            maxLength={100}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || !description.trim() || mutation.isPending}
            className="flex-1 bg-slate-700 text-white text-xs py-1.5 rounded disabled:opacity-40 hover:bg-slate-800"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={handleCancel} className="flex-1 border border-gray-300 text-xs py-1.5 rounded hover:bg-gray-100">
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
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function FarmPanel() {
  const qc = useQueryClient();
  const { selectedFarmId, selectFarm, openModal, modalState, closeModal, farmAnomalyState, seedFarmAnomalyState } = useStore();
  const [showForm, setShowForm] = useState(false);

  const { data: farms, isLoading, isError } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  useEffect(() => {
    if (farms) seedFarmAnomalyState(farms);
  }, [farms, seedFarmAnomalyState]);

  const startAllMutation = useMutation({
    mutationFn: () => api.post(`/farms/${selectedFarmId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: () => api.post(`/farms/${selectedFarmId}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      qc.invalidateQueries({ queryKey: ["windmills", selectedFarmId] });
      qc.invalidateQueries({ queryKey: ["parquet-files"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (farmId: number) => api.delete(`/farms/${farmId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farms"] });
      selectFarm(null);
      closeModal();
    },
  });

  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Wind Park Management</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs bg-slate-700 text-white px-2 py-1 rounded hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "New Wind Park"}
        </button>
      </div>

      {/* Farm list */}
      <div className="flex-1 panel-scroll min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <p className="text-sm text-gray-500 text-center mt-8">Failed to load wind parks.</p>
        ) : !farms || farms.length === 0 ? (
          <p className="text-sm text-gray-500 text-center mt-8">No wind parks yet. Click 'New Wind Park' to get started.</p>
        ) : (
          <ul>
            {farms.map((farm) => (
              <li
                key={farm.id}
                onClick={() => selectFarm(farm.id)}
                title={farm.description}
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                  farm.id === selectedFarmId ? "bg-slate-50 border-l-2 border-l-slate-600" : ""
                }`}
              >
                <div className="text-sm font-medium text-gray-800">{farm.name}</div>
                <div className="text-xs text-gray-400">{farm.id}</div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-green-600">● {farm.running_count}</span>
                  <span className="text-red-500">● {farm.windmill_count - farm.running_count}</span>
                  <span className="text-gray-500">{farm.windmill_count} total</span>
                </div>
                {farmAnomalyState[farm.id] && (
                  <div className="text-xs text-red-600 font-medium mt-0.5">
                    Anomaly detected
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New Farm Form */}
      {showForm && <NewFarmForm onClose={() => setShowForm(false)} />}

      {/* Bottom control bar */}
      <div className="shrink-0 flex gap-1 p-2 border-t border-gray-200 bg-gray-50">
        <button
          disabled={!selectedFarmId}
          onClick={() => startAllMutation.mutate()}
          className="flex-1 text-xs py-1.5 bg-green-600 text-white rounded disabled:opacity-40 hover:bg-green-700"
        >
          Start Park
        </button>
        <button
          disabled={!selectedFarmId}
          onClick={() => stopAllMutation.mutate()}
          className="flex-1 text-xs py-1.5 bg-amber-500 text-white rounded disabled:opacity-40 hover:bg-amber-600"
        >
          Stop Park
        </button>
        <button
          disabled={!selectedFarmId}
          onClick={() =>
            selectedFarm &&
            openModal({
              type: "deleteFarm",
              payload: { id: selectedFarm.id, name: selectedFarm.name },
            })
          }
          className="flex-1 text-xs py-1.5 bg-red-600 text-white rounded disabled:opacity-40 hover:bg-red-700"
        >
          Delete
        </button>
      </div>

      {/* Delete farm modal */}
      {modalState?.type === "deleteFarm" && (
        <ConfirmDialog
          open
          title={`Delete "${modalState.payload.name}"?`}
          body="Are you sure you want to delete this wind park? This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={() => deleteMutation.mutate(modalState.payload.id)}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}
