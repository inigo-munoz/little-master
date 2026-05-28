const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://127.0.0.1:3001";
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 500;

export async function waitForBackend(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`, {
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
