"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Img = { src: string; alt: string };

// Renderiza Markdown de tutoriais (sem HTML cru — seguro por padrão).
// Clicar numa imagem abre o lightbox; com várias, vira carrossel.
export default function MarkdownView({ markdown }: { markdown: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Todas as imagens do documento, na ordem em que aparecem.
  const images = useMemo<Img[]>(() => {
    const found: Img[] = [];
    for (const m of markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
      found.push({ alt: m[1], src: m[2] });
    }
    return found;
  }, [markdown]);

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : "";
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={alt ?? ""}
                title="Clique para ampliar"
                className="cursor-zoom-in transition-opacity hover:opacity-90"
                onClick={() => {
                  const i = images.findIndex((img) => img.src === url);
                  setOpenIndex(i >= 0 ? i : 0);
                }}
              />
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>

      {openIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={Math.min(openIndex, images.length - 1)}
          onNavigate={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onNavigate,
  onClose,
}: {
  images: Img[];
  index: number;
  onNavigate: (i: number) => void;
  onClose: () => void;
}) {
  const many = images.length > 1;
  const current = images[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (many && e.key === "ArrowRight") onNavigate((index + 1) % images.length);
      if (many && e.key === "ArrowLeft") {
        onNavigate((index - 1 + images.length) % images.length);
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, many, images.length, onNavigate, onClose]);

  // Portal no <body>: ancestrais com transform (animações dos cards)
  // prendem o position:fixed e cortariam o overlay.
  return createPortal(
    <div
      className="anim-overlay fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        onClick={onClose}
        className="vlt-icon-btn absolute top-4 right-4 !bg-white/10 !text-white hover:!bg-white/20"
        title="Fechar (Esc)"
      >
        <X className="size-5" />
      </button>

      {many && (
        <button
          onClick={() => onNavigate((index - 1 + images.length) % images.length)}
          className="vlt-icon-btn absolute left-4 !rounded-full !bg-white/10 !p-3 !text-white hover:!bg-white/20"
          title="Anterior (←)"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.src}
        src={current.src}
        alt={current.alt}
        className="anim-pop max-h-[82vh] max-w-[90vw] rounded-xl border border-white/10 object-contain shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      />

      {many && (
        <button
          onClick={() => onNavigate((index + 1) % images.length)}
          className="vlt-icon-btn absolute right-4 !rounded-full !bg-white/10 !p-3 !text-white hover:!bg-white/20"
          title="Próxima (→)"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      <div className="pointer-events-none absolute bottom-5 flex flex-col items-center gap-1 text-white/80">
        {current.alt && <p className="text-xs">{current.alt}</p>}
        {many && (
          <p className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.7rem] tabular-nums">
            {index + 1} / {images.length}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
