/**
 * Axios instance with global error interceptor.
 *
 * Mutations can suppress the interceptor for 409/422 responses by setting
 * `skipGlobalErrorHandler: true` in the request config (used for form mutations
 * that handle those codes inline).
 */
import axios from "axios";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    skipGlobalErrorHandler?: boolean;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

/** Global response error interceptor: shows a toast on API errors. */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config as import("axios").InternalAxiosRequestConfig | undefined;
    const status: number | undefined = error.response?.status;

    if (config?.skipGlobalErrorHandler && (status === 409 || status === 422)) {
      return Promise.reject(error);
    }

    const detail: string =
      error.response?.data?.detail ??
      error.response?.data?.message ??
      error.message ??
      "Unexpected error";

    showToast(detail);
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Minimal toast implementation (no extra library required)
// ---------------------------------------------------------------------------

function showToast(message: string): void {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = [
    "position:fixed",
    "bottom:1.5rem",
    "right:1.5rem",
    "background:#1e293b",
    "color:#f8fafc",
    "padding:0.75rem 1.25rem",
    "border-radius:0.5rem",
    "font-size:0.875rem",
    "max-width:24rem",
    "z-index:9999",
    "box-shadow:0 4px 12px rgba(0,0,0,0.3)",
    "word-break:break-word",
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

export default api;

/** Derive WebSocket base URL from VITE_API_BASE_URL. */
export function wsBaseUrl(): string {
  return BASE_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}
