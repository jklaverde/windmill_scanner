/**
 * WebSocket client wrapper with exponential backoff reconnection.
 *
 * - type:error from server → permanent failure, no retry.
 * - TCP close            → backoff retry (1s, 2s, 4s, 8s, 16s, then error after 5 attempts).
 */
import type { WsMessage } from "../domain/types";
import { wsBaseUrl } from "./api";

export type WsCallback = (msg: WsMessage) => void;
export type WsStatusCallback = (status: "connecting" | "running" | "stopped" | "error") => void;

const MAX_ATTEMPTS = 5;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export class WindmillWebSocket {
  private socket: WebSocket | null = null;
  private windmillId: string = "";
  private attempts = 0;
  private destroyed = false;
  private readonly onMessage: WsCallback;
  private readonly onStatusChange: WsStatusCallback;

  constructor(onMessage: WsCallback, onStatusChange: WsStatusCallback) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  /** Open a connection for windmill_id. Resets any prior state. */
  connect(windmillId: string): void {
    this.destroy();
    this.windmillId = windmillId;
    this.attempts = 0;
    this.destroyed = false;
    this._open();
  }

  /** Permanently close the connection (no retry). */
  destroy(): void {
    this.destroyed = true;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private _open(): void {
    if (this.destroyed) return;
    this.onStatusChange("connecting");
    const url = `${wsBaseUrl()}/ws/${this.windmillId}`;
    const ws = new WebSocket(url);
    this.socket = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        if (msg.type === "error") {
          // Permanent failure — do not retry
          this.destroy();
          this.onStatusChange("error");
          return;
        }
        this.onMessage(msg);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.attempts += 1;
      if (this.attempts >= MAX_ATTEMPTS) {
        this.onStatusChange("error");
        return;
      }
      const delay = Math.min(INITIAL_DELAY_MS * 2 ** (this.attempts - 1), MAX_DELAY_MS);
      setTimeout(() => this._open(), delay);
    };

    ws.onerror = () => {
      // onclose fires after onerror; no extra action needed here
    };
  }
}
