"use client";

import { useEffect } from "react";
import { Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <h2 className="font-semibold text-stone-100 text-sm">{title}</h2>
          <button
            onClick={onCancel}
            className="text-stone-500 hover:text-stone-300 transition-colors p-1 rounded"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-1">
          <p className="text-sm text-stone-300">{message}</p>
          <p className="text-xs text-stone-600">Esta acción no se puede deshacer.</p>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300 rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Trash2 size={13} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
