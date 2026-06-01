"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { waitForBackend } from "../../lib/backend-ready";

function BackendError() {
  return (
    <div className="flex items-center justify-center h-screen bg-stone-950">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold text-red-400 mb-2">Error de conexión</h1>
        <p className="text-stone-400 text-sm">
          No se pudo conectar con el servidor local. Reinicia la aplicación.
        </p>
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

  useEffect(() => {
    waitForBackend().then((ok) => setStatus(ok ? "ready" : "error"));
  }, []);

  if (status === "error") return <BackendError />;
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
