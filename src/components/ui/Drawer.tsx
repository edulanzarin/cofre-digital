"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export default function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="anim-overlay fixed inset-0 z-50 bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="anim-slide-in fixed inset-y-0 right-0 flex w-[27rem] max-w-[calc(100vw-1rem)] flex-col border-l border-line bg-panel shadow-(--shadow-float)">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="vlt-icon-btn -mr-2" title="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
