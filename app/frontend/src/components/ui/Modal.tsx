"use client";

import type { ReactNode, RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx } from "clsx";

/** Descripción accesible del diálogo; úsese dentro de <Modal hasDescription>. */
export const ModalDescription = Dialog.Description;

interface ModalProps {
  /** Si el diálogo está abierto. Los modales montados condicionalmente pasan `true`. */
  open?: boolean;
  /** Se invoca en cualquier vía de cierre: Escape, clic en el fondo o botón X. */
  onClose: () => void;
  /** Nombre accesible del diálogo (Dialog.Title). */
  title: string;
  /**
   * Contenido secundario bajo el título. Una cadena se envuelve en el estilo
   * por defecto; un nodo se renderiza tal cual, para los sitios que ya tenían
   * su propio marcado ahí (badges, descripción con otro tamaño).
   */
  subtitle?: ReactNode;
  /** Icono a la izquierda del título, opcional. */
  icon?: ReactNode;
  /** Ancho máximo del panel, p. ej. "max-w-sm". */
  maxWidth?: string;
  /** "compact": cabecera de confirmación. "comfortable": cabecera de ficha de detalle. */
  density?: "compact" | "comfortable";
  /** Sustituye por completo las clases del título (por defecto: color y tamaño según `density`). */
  titleClassName?: string;
  /** Clases extra del panel (p. ej. altura máxima y flex-col). */
  panelClassName?: string;
  /**
   * Indica que `children` incluye un <ModalDescription>. Si es false se pasa
   * `aria-describedby={undefined}` a propósito: es la forma correcta de
   * silenciar el aviso de Radix cuando no hay texto descriptivo real.
   */
  hasDescription?: boolean;
  /**
   * Sustituye la alineación vertical del panel dentro del fondo. Por defecto
   * va centrado; `SpellsTab` lo usa para conservar su hoja inferior en móvil
   * ("items-end sm:items-center"). Sustituye, no añade: dos clases `items-*`
   * en el mismo elemento las resuelve el orden del CSS, no el de la cadena.
   */
  align?: string;
  /**
   * Elemento a enfocar al abrir, en vez del primer enfocable. Radix mueve el
   * foco al abrir, lo que anula un `autoFocus` dentro del diálogo.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Primitiva de modal sobre Radix Dialog. Radix aporta role="dialog",
 * aria-modal, trampa y restauración de foco, Escape y bloqueo de scroll.
 * Este es el único sitio que debe producir esa semántica.
 */
export function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = "max-w-md",
  density = "compact",
  panelClassName,
  titleClassName,
  hasDescription = false,
  align = "items-center",
  initialFocusRef,
  children,
}: ModalProps) {
  const compact = density === "compact";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* Los eventos sintéticos de React burbujean a través del portal:
            se frenan para que un clic dentro no active el onClick de un ancestro. */}
        <Dialog.Overlay
          className={clsx("fixed inset-0 bg-black/70 flex justify-center z-50 p-4", align)}
          onClick={(e) => e.stopPropagation()}
        >
          <Dialog.Content
            {...(hasDescription ? {} : { "aria-describedby": undefined })}
            onOpenAutoFocus={
              initialFocusRef
                ? (e) => {
                    e.preventDefault();
                    initialFocusRef.current?.focus();
                  }
                : undefined
            }
            className={clsx(
              "bg-stone-900 border border-stone-700 rounded-xl w-full shadow-2xl",
              maxWidth,
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={clsx(
                "flex items-center justify-between border-b border-stone-800 shrink-0",
                compact ? "px-5 py-4" : "px-6 py-4",
              )}
            >
              <div className={clsx("flex items-center", icon && "gap-3")}>
                {icon}
                <div>
                  <Dialog.Title
                    className={
                      titleClassName ??
                      clsx("font-semibold text-stone-100", compact ? "text-sm" : "text-lg")
                    }
                  >
                    {title}
                  </Dialog.Title>
                  {subtitle &&
                    (typeof subtitle === "string"
                      ? <p className="text-xs text-stone-500">{subtitle}</p>
                      : subtitle)}
                </div>
              </div>
              <Dialog.Close
                className={clsx(
                  "text-stone-500 hover:text-stone-300 transition-colors p-1",
                  compact && "rounded",
                )}
                aria-label="Cerrar"
              >
                <X size={compact ? 15 : 18} />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
