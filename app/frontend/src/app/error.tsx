"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-lg border border-red-800 bg-red-950/50 p-8 text-center">
        <h2 className="mb-2 text-xl font-bold text-red-400">
          Algo salió mal
        </h2>
        <p className="mb-6 text-stone-400">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al
          inicio.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
            aria-label="Reintentar la acción que falló"
          >
            Reintentar
          </button>
          <Link
            href="/campaigns"
            className="rounded-md border border-stone-600 px-4 py-2 text-sm font-medium text-stone-300 hover:bg-stone-800"
          >
            Ir a campañas
          </Link>
        </div>
      </div>
    </div>
  );
}
