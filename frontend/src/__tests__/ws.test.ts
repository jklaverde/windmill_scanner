import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WindmillWebSocket } from '../infra/ws';

vi.mock('../infra/api', () => ({
  default: {},
  wsBaseUrl: () => 'ws://localhost:8000',
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  drop() {
    this.onclose?.();
  }
}

vi.stubGlobal('WebSocket', FakeWebSocket);

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WindmillWebSocket', () => {
  it('opens a connection to the correct URL on connect()', () => {
    const ws = new WindmillWebSocket(() => {}, () => {});
    ws.connect('wm-1');
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:8000/ws/wm-1');
  });

  it('calls onStatusChange("connecting") on connect', () => {
    const onStatus = vi.fn();
    const ws = new WindmillWebSocket(() => {}, onStatus);
    ws.connect('wm-1');
    expect(onStatus).toHaveBeenCalledWith('connecting');
  });

  it('delivers received messages to onMessage callback', () => {
    const onMsg = vi.fn();
    const ws = new WindmillWebSocket(onMsg, () => {});
    ws.connect('wm-1');
    const socket = FakeWebSocket.instances[0];
    const payload = { type: 'status', status: 'started', windmill_id: 'wm-1', message: 'ok' };
    socket.emit(payload);
    expect(onMsg).toHaveBeenCalledWith(payload);
  });

  it('does not retry on type:error — calls onStatusChange("error") once', () => {
    const onStatus = vi.fn();
    const ws = new WindmillWebSocket(() => {}, onStatus);
    ws.connect('wm-1');
    FakeWebSocket.instances[0].emit({ type: 'error', message: 'Windmill not found' });

    // Advance timers — no reconnect should happen
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onStatus).toHaveBeenCalledWith('error');
  });

  it('retries after TCP close with exponential backoff', () => {
    const ws = new WindmillWebSocket(() => {}, () => {});
    ws.connect('wm-1');
    FakeWebSocket.instances[0].drop(); // attempt 1

    vi.advanceTimersByTime(1000);  // 1s delay → reconnect
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].drop(); // attempt 2
    vi.advanceTimersByTime(2000);  // 2s delay → reconnect
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('stops retrying after MAX_ATTEMPTS and reports error', () => {
    const onStatus = vi.fn();
    const ws = new WindmillWebSocket(() => {}, onStatus);
    ws.connect('wm-1');

    // Simulate 5 drops (MAX_ATTEMPTS = 5)
    for (let i = 0; i < 5; i++) {
      const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
      socket.drop();
      vi.advanceTimersByTime(30_000);
    }

    expect(onStatus).toHaveBeenLastCalledWith('error');
    const countBefore = FakeWebSocket.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances.length).toBe(countBefore); // no more reconnects
  });

  it('destroy() prevents reconnection after close', () => {
    const ws = new WindmillWebSocket(() => {}, () => {});
    ws.connect('wm-1');
    ws.destroy();
    FakeWebSocket.instances[0].drop();

    vi.advanceTimersByTime(30_000);
    expect(FakeWebSocket.instances).toHaveLength(1); // no retry
  });

  it('connect() on a new windmill closes the previous socket', () => {
    const ws = new WindmillWebSocket(() => {}, () => {});
    ws.connect('wm-1');
    ws.connect('wm-2');
    expect(FakeWebSocket.instances[0].closed).toBe(true);
    expect(FakeWebSocket.instances[1].url).toBe('ws://localhost:8000/ws/wm-2');
  });
});
