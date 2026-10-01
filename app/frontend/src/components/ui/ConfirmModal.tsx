"use client";

import { Trash2 } from "lucide-react";
import { Modal, ModalDescription } from "./Modal";

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
  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-sm"
      hasDescription
    >
      <div className="px-5 py-4 space-y-1">
        <ModalDescription className="text-sm text-stone-300">{message}</ModalDescription>
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
    </Modal>
  );
}
