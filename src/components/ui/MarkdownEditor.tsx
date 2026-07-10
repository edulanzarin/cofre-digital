"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  Link2,
  ImagePlus,
  ListOrdered,
} from "lucide-react";
import MarkdownView from "./MarkdownView";

// Ferramentas da toolbar: dados puros; a inserção acontece no onClick.
const TOOLS = [
  { icon: Bold, title: "Negrito", before: "**", after: "**", placeholder: "texto" },
  { icon: Italic, title: "Itálico", before: "_", after: "_", placeholder: "texto" },
  { icon: Heading2, title: "Título", before: "\n## ", after: "", placeholder: "Título" },
  { icon: List, title: "Lista", before: "\n- ", after: "", placeholder: "item" },
  { icon: ListOrdered, title: "Passos numerados", before: "\n1. ", after: "", placeholder: "passo" },
  { icon: Link2, title: "Link", before: "[", after: "](https://)", placeholder: "texto" },
] as const;

// Editor de tutorial: Markdown com toolbar, prévia e imagens
// (upload ou Ctrl+V) enviadas para /api/images.
export default function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function insert(before: string, after = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function uploadImage(file: File) {
    setError("");
    if (file.size > 4 * 1024 * 1024) {
      setError("Imagem muito grande (máx. 4 MB).");
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type, data: btoa(bin) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao enviar a imagem.");
      }
      const { url } = (await res.json()) as { url: string };
      insert(`\n![print](${url})\n`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    if (item) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        uploadImage(file);
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1.5">
        <div className="flex items-center">
          {TOOLS.map(({ icon: Icon, title, before, after, placeholder }) => (
            <button
              key={title}
              type="button"
              onClick={() => insert(before, after, placeholder)}
              title={title}
              className="vlt-icon-btn !p-1.5"
            >
              <Icon className="size-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Inserir imagem (ou cole com Ctrl+V)"
            className="vlt-icon-btn !p-1.5"
            disabled={uploading}
          >
            <ImagePlus className="size-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="vlt-segment !p-0.5">
          <button
            type="button"
            data-active={tab === "write"}
            onClick={() => setTab("write")}
          >
            Escrever
          </button>
          <button
            type="button"
            data-active={tab === "preview"}
            onClick={() => setTab("preview")}
          >
            Prévia
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={
            "Escreva o passo a passo em Markdown…\n\n## Como acessar\n1. Abra o site\n2. Informe o CNPJ\n\nCole prints direto com Ctrl+V."
          }
          className="block max-h-96 min-h-48 w-full resize-y bg-transparent px-3.5 py-3 font-mono text-[0.8rem] leading-relaxed outline-none placeholder:text-ink-3"
        />
      ) : (
        <div className="max-h-96 min-h-48 overflow-y-auto px-4 py-3">
          {value.trim() ? (
            <MarkdownView markdown={value} />
          ) : (
            <p className="text-sm text-ink-3">Nada para pré-visualizar ainda.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line px-3 py-1.5">
        <p className="text-[0.65rem] text-ink-3">
          {uploading ? "Enviando imagem…" : "Markdown · imagens por upload ou Ctrl+V"}
        </p>
        {error && <p className="text-[0.65rem] text-bad">{error}</p>}
      </div>
    </div>
  );
}
