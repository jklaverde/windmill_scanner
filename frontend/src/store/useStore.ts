/**
 * Global Zustand store — all client-side state not owned by TanStack Query.
 */
import { create } from "zustand";
import type {
  SensorReading,
  NotificationEntry,
  WsConnectionStatus,
  HistoryScale,
  YAxisMode,
  ModalState,
  Windmill,
} from "../domain/types";

const MAX_BUFFER = 100;
const MAX_NOTIFICATIONS = 500;

interface StoreState {
  // Selection
  selectedFarmId: number | null;
  selectedWindmillId: string | null;

  // Real-time signals
  signalsBuffer: SensorReading[];
  wsStatus: WsConnectionStatus;

  // Notifications
  notifications: NotificationEntry[];
  sseConnected: boolean;

  // Modal
  modalState: ModalState;

  // Edit flow
  wasRunningBeforeEdit: boolean;

  // Chart configuration
  signalsYAxisMode: YAxisMode;
  historyYAxisMode: YAxisMode;
  historyScale: HistoryScale;

  // Anomaly state (in-memory; cleared by ETL success, seeded from API on load)
  windmillAnomalyState: Record<string, boolean>;
  farmAnomalyState: Record<number, boolean>;
  windmillFarmMap: Record<string, number>;

  // Actions
  selectFarm: (id: number | null) => void;
  selectWindmill: (id: string | null) => void;
  pushReading: (reading: SensorReading) => void;
  clearBuffer: () => void;
  setWsStatus: (status: WsConnectionStatus) => void;
  seedNotifications: (entries: NotificationEntry[]) => void;
  addNotification: (entry: NotificationEntry) => void;
  clearNotifications: () => void;
  setSseConnected: (connected: boolean) => void;
  openModal: (state: ModalState) => void;
  closeModal: () => void;
  setWasRunningBeforeEdit: (v: boolean) => void;
  setSignalsYAxisMode: (mode: YAxisMode) => void;
  setHistoryYAxisMode: (mode: YAxisMode) => void;
  setHistoryScale: (scale: HistoryScale) => void;
  setWindmillAnomaly: (id: string, val: boolean) => void;
  clearWindmillAnomaly: (id: string) => void;
  seedWindmillAnomalyState: (windmills: Windmill[]) => void;
  seedFarmAnomalyState: (farms: import("../domain/types").Farm[]) => void;
}

export const useStore = create<StoreState>((set) => ({
  selectedFarmId: null,
  selectedWindmillId: null,
  signalsBuffer: [],
  wsStatus: "idle",
  notifications: [],
  sseConnected: false,
  modalState: null,
  wasRunningBeforeEdit: false,
  signalsYAxisMode: "auto",
  historyYAxisMode: "auto",
  historyScale: "minute",
  windmillAnomalyState: {},
  farmAnomalyState: {},
  windmillFarmMap: {},

  selectFarm: (id) =>
    set(() => ({
      selectedFarmId: id,
      selectedWindmillId: null,
      signalsBuffer: [],
      wsStatus: "idle",
    })),

  selectWindmill: (id) =>
    set(() => ({
      selectedWindmillId: id,
      signalsBuffer: [],
      wsStatus: id ? "connecting" : "idle",
    })),

  pushReading: (reading) =>
    set((s) => {
      const next = [...s.signalsBuffer, reading];
      return { signalsBuffer: next.length > MAX_BUFFER ? next.slice(-MAX_BUFFER) : next };
    }),

  clearBuffer: () => set({ signalsBuffer: [], wsStatus: "idle" }),

  setWsStatus: (status) => set({ wsStatus: status }),

  seedNotifications: (entries) => set({ notifications: entries }),

  addNotification: (entry) =>
    set((s) => {
      const next = [entry, ...s.notifications];
      return { notifications: next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next };
    }),

  clearNotifications: () => set({ notifications: [] }),

  setSseConnected: (connected) => set({ sseConnected: connected }),

  openModal: (state) => set({ modalState: state }),

  closeModal: () => set({ modalState: null }),

  setWasRunningBeforeEdit: (v) => set({ wasRunningBeforeEdit: v }),

  setSignalsYAxisMode: (mode) => set({ signalsYAxisMode: mode }),

  setHistoryYAxisMode: (mode) => set({ historyYAxisMode: mode }),

  setHistoryScale: (scale) => set({ historyScale: scale }),

  setWindmillAnomaly: (id, val) =>
    set((s) => {
      const nextWindmill = { ...s.windmillAnomalyState, [id]: val };
      const farmId = s.windmillFarmMap[id];
      const nextFarm = (farmId !== undefined && val)
        ? { ...s.farmAnomalyState, [farmId]: true }
        : s.farmAnomalyState;
      return { windmillAnomalyState: nextWindmill, farmAnomalyState: nextFarm };
    }),

  clearWindmillAnomaly: (id) =>
    set((s) => {
      const nextWindmill = { ...s.windmillAnomalyState };
      delete nextWindmill[id];
      const farmId = s.windmillFarmMap[id];
      const nextFarm = { ...s.farmAnomalyState };
      if (farmId !== undefined) {
        const anyLeft = Object.entries(s.windmillFarmMap).some(
          ([wid, fid]) => fid === farmId && wid !== id && nextWindmill[wid],
        );
        if (!anyLeft) delete nextFarm[farmId];
      }
      return { windmillAnomalyState: nextWindmill, farmAnomalyState: nextFarm };
    }),

  seedWindmillAnomalyState: (windmills) =>
    set((s) => {
      const nextWindmill = { ...s.windmillAnomalyState };
      const nextMap = { ...s.windmillFarmMap };
      const nextFarm = { ...s.farmAnomalyState };
      let farmId: number | null = null;
      let farmHasAnomaly = false;
      for (const wm of windmills) {
        farmId = wm.farm_id;
        nextMap[wm.windmill_id] = wm.farm_id;
        if (wm.latest_anomaly === true) {
          nextWindmill[wm.windmill_id] = true;
          farmHasAnomaly = true;
        } else {
          if (!nextWindmill[wm.windmill_id]) {
            delete nextWindmill[wm.windmill_id];
          } else {
            farmHasAnomaly = true;
          }
        }
      }
      if (farmId !== null) {
        if (farmHasAnomaly) nextFarm[farmId] = true;
        else delete nextFarm[farmId];
      }
      return { windmillAnomalyState: nextWindmill, windmillFarmMap: nextMap, farmAnomalyState: nextFarm };
    }),

  seedFarmAnomalyState: (farms) =>
    set((s) => {
      const nextFarm = { ...s.farmAnomalyState };
      for (const farm of farms) {
        if (farm.has_anomaly) {
          nextFarm[farm.id] = true;
        } else if (!nextFarm[farm.id]) {
          delete nextFarm[farm.id];
        }
      }
      return { farmAnomalyState: nextFarm };
    }),
}));
