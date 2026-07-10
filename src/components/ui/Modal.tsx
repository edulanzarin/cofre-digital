"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
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
      className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`vlt-card anim-pop w-full shadow-(--shadow-float) ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="vlt-icon-btn -mr-2" title="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
