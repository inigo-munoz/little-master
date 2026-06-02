import { initBackendUrl } from "./backend-url";

const MAX_RETRIES = 30;
const RETRY_INTERVAL = 500;

export async function waitForBackend(): Promise<boolean> {
  const backendUrl = await initBackendUrl();

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${backendUrl}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return true;
    } catch {
      // Backend not ready yet
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
  }
  return false;
}
