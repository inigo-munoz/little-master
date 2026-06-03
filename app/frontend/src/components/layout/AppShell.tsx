"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { waitForBackend, type BackendStatus } from "../../lib/backend-ready";

function BackendError({ url, lastError }: { url: string; lastError?: string }) {
  return (
    <div className="flex items-center justify-center h-screen bg-stone-950">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold text-red-400 mb-2">Error de conexión</h1>
        <p className="text-stone-400 text-sm">
          No se pudo conectar con el servidor local. Reinicia la aplicación.
        </p>
        <div className="mt-4 text-xs text-stone-600 font-mono space-y-1">
          <p>URL: {url}</p>
          {lastError && <p>Error: {lastError}</p>}
        </div>
      </div>
    </div>
  );
}

function LoadingSplash() {
  return (
    <div className="flex items-center justify-center h-screen bg-stone-950">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-stone-400 text-sm">Iniciando...</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [diagnostic, setDiagnostic] = useState<BackendStatus>({ ok: false, url: "" });

  useEffect(() => {
    waitForBackend().then((result) => {
      setDiagnostic(result);
      setStatus(result.ok ? "ready" : "error");
    });
  }, []);

  if (status === "error") return <BackendError url={diagnostic.url} lastError={diagnostic.lastError} />;
  if (status === "checking") return <LoadingSplash />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-stone-950">
        {children}
      </main>
    </div>
  );
}
