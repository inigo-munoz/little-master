let _url: string | null = null;

export async function initBackendUrl(): Promise<string> {
  if (_url) return _url;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    const port = await invoke<number>("get_backend_port");
    _url = `http://127.0.0.1:${port}`;
  } else {
    _url =
      process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001";
  }

  return _url;
}

export function getBackendUrl(): string {
  return (
    _url ??
    process.env["NEXT_PUBLIC_BACKEND_URL"] ??
    "http://localhost:3001"
  );
}
