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
}));
