import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import type { SensorReading, NotificationEntry } from '../domain/types';

const INITIAL: Parameters<typeof useStore.setState>[0] = {
  selectedFarmId: null,
  selectedWindmillId: null,
  signalsBuffer: [],
  wsStatus: 'idle',
  notifications: [],
  sseConnected: false,
  modalState: null,
  wasRunningBeforeEdit: false,
  signalsYAxisMode: 'auto',
  historyYAxisMode: 'auto',
  historyScale: 'minute',
};

beforeEach(() => {
  useStore.setState(INITIAL);
});

const makeReading = (i: number): SensorReading => ({
  measurement_timestamp: new Date(i * 1000).toISOString(),
  temperature: i * 1.0,
  noise_level: i * 2.0,
  humidity: i * 3.0,
  wind_speed: i * 0.5,
});

const makeNotification = (i: number): NotificationEntry => ({
  timestamp: new Date(i * 1000).toISOString(),
  level: 'info',
  message: `msg ${i}`,
  entity_type: 'system',
  entity_id: null,
});

describe('selectFarm', () => {
  it('sets selectedFarmId', () => {
    useStore.getState().selectFarm(3);
    expect(useStore.getState().selectedFarmId).toBe(3);
  });

  it('resets selectedWindmillId', () => {
    useStore.getState().selectWindmill('wm-1');
    useStore.getState().selectFarm(3);
    expect(useStore.getState().selectedWindmillId).toBeNull();
  });

  it('clears signalsBuffer', () => {
    useStore.getState().pushReading(makeReading(1));
    useStore.getState().selectFarm(3);
    expect(useStore.getState().signalsBuffer).toHaveLength(0);
  });

  it('accepts null to deselect', () => {
    useStore.getState().selectFarm(3);
    useStore.getState().selectFarm(null);
    expect(useStore.getState().selectedFarmId).toBeNull();
  });
});

describe('selectWindmill', () => {
  it('sets selectedWindmillId', () => {
    useStore.getState().selectWindmill('wm-42');
    expect(useStore.getState().selectedWindmillId).toBe('wm-42');
  });

  it('sets wsStatus to connecting when windmill selected', () => {
    useStore.getState().selectWindmill('wm-1');
    expect(useStore.getState().wsStatus).toBe('connecting');
  });

  it('sets wsStatus to idle when deselected', () => {
    useStore.getState().selectWindmill('wm-1');
    useStore.getState().selectWindmill(null);
    expect(useStore.getState().wsStatus).toBe('idle');
  });
});

describe('pushReading', () => {
  it('adds a reading to the buffer', () => {
    useStore.getState().pushReading(makeReading(1));
    expect(useStore.getState().signalsBuffer).toHaveLength(1);
  });

  it('caps buffer at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      useStore.getState().pushReading(makeReading(i));
    }
    expect(useStore.getState().signalsBuffer).toHaveLength(100);
  });

  it('keeps the most recent 100 when capped', () => {
    for (let i = 0; i < 110; i++) {
      useStore.getState().pushReading(makeReading(i));
    }
    const buffer = useStore.getState().signalsBuffer;
    expect(buffer[0].temperature).toBe(10);   // i=10 is oldest kept
    expect(buffer[99].temperature).toBe(109);
  });
});

describe('addNotification', () => {
  it('prepends to notifications', () => {
    useStore.getState().addNotification(makeNotification(1));
    useStore.getState().addNotification(makeNotification(2));
    expect(useStore.getState().notifications[0].message).toBe('msg 2');
  });

  it('caps notifications at 500', () => {
    for (let i = 0; i < 510; i++) {
      useStore.getState().addNotification(makeNotification(i));
    }
    expect(useStore.getState().notifications).toHaveLength(500);
  });
});

describe('clearNotifications', () => {
  it('empties the list', () => {
    useStore.getState().addNotification(makeNotification(1));
    useStore.getState().clearNotifications();
    expect(useStore.getState().notifications).toHaveLength(0);
  });
});

describe('setWasRunningBeforeEdit', () => {
  it('sets the flag', () => {
    useStore.getState().setWasRunningBeforeEdit(true);
    expect(useStore.getState().wasRunningBeforeEdit).toBe(true);
  });
});

describe('seedNotifications', () => {
  it('replaces all notifications', () => {
    useStore.getState().addNotification(makeNotification(1));
    const seeded = [makeNotification(10), makeNotification(11)];
    useStore.getState().seedNotifications(seeded);
    expect(useStore.getState().notifications).toHaveLength(2);
    expect(useStore.getState().notifications[0].message).toBe('msg 10');
  });
});
