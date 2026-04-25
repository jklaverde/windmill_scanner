/**
 * SSE EventSource wrapper for the /notifications/stream endpoint.
 *
 * Fires onEntry for each new_notification event.
 * Fires onConnectionChange when the stream connects or disconnects.
 */
import type { NotificationEntry } from "../domain/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type SseEntryCallback = (entry: NotificationEntry) => void;
export type SseConnectionCallback = (connected: boolean) => void;

export class NotificationSSE {
  private es: EventSource | null = null;
  private readonly onEntry: SseEntryCallback;
  private readonly onConnectionChange: SseConnectionCallback;

  constructor(onEntry: SseEntryCallback, onConnectionChange: SseConnectionCallback) {
    this.onEntry = onEntry;
    this.onConnectionChange = onConnectionChange;
  }

  /** Open the SSE stream. Reconnects automatically via browser EventSource. */
  connect(): void {
    if (this.es) return;
    const url = `${BASE_URL}/notifications/stream`;
    this.es = new EventSource(url);

    this.es.onopen = () => this.onConnectionChange(true);

    this.es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          entry?: NotificationEntry;
        };
        if (data.type === "new_notification" && data.entry) {
          this.onEntry(data.entry);
        }
        // keepalive events are intentionally ignored
      } catch {
        // ignore malformed frames
      }
    };

    this.es.onerror = () => {
      this.onConnectionChange(false);
      // EventSource reconnects automatically; we just signal disconnected state
    };
  }

  /** Permanently close the stream. */
  destroy(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.onConnectionChange(false);
  }
}
