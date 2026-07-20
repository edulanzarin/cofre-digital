"use client";

import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { dismissToast, useToasts, type ToastKind } from "@/lib/toast";

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export default function Toaster() {
  const toasts = useToasts();

  // Sem toast, sem portal. Isso também resolve o SSR: no servidor a pilha
  // está sempre vazia, então o createPortal (que precisa do document) nunca
  // roda lá — o primeiro toast só nasce de uma ação do usuário, já hidratado.
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      // aria-live: leitor de tela anuncia sem roubar o foco de onde o
      // usuário está — era o que o alert() fazia de errado.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map(({ id, kind, message }) => {
        const Icon = ICON[kind];
        return (
          <div
            key={id}
            data-kind={kind}
            className="vlt-toast anim-toast-in pointer-events-auto"
          >
            <Icon
              className="mt-px size-4 shrink-0"
              style={{ color: "var(--toast-accent)" }}
              strokeWidth={2}
            />
            <p className="min-w-0 flex-1 break-words text-ink">{message}</p>
            <button
              onClick={() => dismissToast(id)}
              className="vlt-icon-btn -my-1 -mr-1.5 !p-1"
              title="Fechar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
