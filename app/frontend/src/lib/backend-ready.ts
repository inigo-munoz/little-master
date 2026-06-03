import { initBackendUrl } from "./backend-url";

const MAX_RETRIES = 60;
const RETRY_INTERVAL = 500;

export interface BackendStatus {
  ok: boolean;
  url: string;
  lastError?: string;
}

export async function waitForBackend(): Promise<BackendStatus> {
  const backendUrl = await initBackendUrl();
  let lastError = "";

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${backendUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return { ok: true, url: backendUrl };
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  return { ok: false, url: backendUrl, lastError };
}
