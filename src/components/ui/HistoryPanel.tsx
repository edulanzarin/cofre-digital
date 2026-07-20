"use client";

import { useEffect, useState } from "react";
import {
  History,
  MessageSquareText,
  PencilLine,
  PlusCircle,
  Send,
} from "lucide-react";

// Evento da linha do tempo — mesmo shape nas APIs de certificados e alvarás.
export type HistoryEvent = {
  id: string;
  kind: "created" | "updated" | "note";
  message?: string;
  userName: string;
  createdAt: string; // ISO
};

const KIND_META: Record<
  HistoryEvent["kind"],
  { label: string; icon: typeof History; color: string; soft: string }
> = {
  created: {
    label: "Guardado no cofre",
    icon: PlusCircle,
    color: "var(--ok)",
    soft: "var(--ok-soft)",
  },
  updated: {
    label: "Dados atualizados",
    icon: PencilLine,
    color: "var(--info)",
    soft: "var(--info-soft)",
  },
  note: {
    label: "Observação",
    icon: MessageSquareText,
    color: "var(--brand)",
    soft: "var(--brand-soft)",
  },
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// "agora", "há 35 min", "há 3 h", "há 12 dias" — e a data completa no title.
function relativeWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MIN) return "agora";
  if (diff < HOUR) return `há ${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
  const days = Math.floor(diff / DAY);
  if (days < 60) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fullWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Painel de histórico de um item do cofre: linha do tempo completa
// (cadastro, alterações e observações da equipe) + campo para anotar.
// `endpoint` é a rota de eventos do item (GET lista, POST cria nota).
export default function HistoryPanel({
  endpoint,
  placeholder,
}: {
  endpoint: string;
  placeholder: string;
}) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then((r) => (r.ok ? (r.json() as Promise<HistoryEvent[]>) : []))
      .then((data) => {
        if (active) setEvents(data);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  async function addNote() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Falha ao salvar a observação.");
        return;
      }
      const created = (await res.json()) as HistoryEvent;
      setEvents((prev) => [created, ...(prev ?? [])]);
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  const noteCount = events?.filter((e) => e.kind === "note").length ?? 0;

  return (
    <>
      {/* Cabeçalho do painel */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
          <History className="size-3.5 text-brand" />
          Histórico
        </p>
        {events !== null && (
          <span className="text-[0.68rem] text-ink-3">
            {events.length} {events.length === 1 ? "registro" : "registros"}
            {noteCount > 0 && ` · ${noteCount} obs.`}
          </span>
        )}
      </div>

      {/* Nova observação */}
      <div className="border-b border-line px-5 py-3.5">
        <textarea
          className="vlt-input min-h-16 w-full resize-y text-[0.82rem]"
          placeholder={placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addNote();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[0.65rem] text-ink-3">
            Fica registrado com seu nome e a data.
          </p>
          <button
            type="button"
            onClick={addNote}
            disabled={!message.trim() || sending}
            className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
          >
            <Send className="size-3.5" />
            {sending ? "Salvando…" : "Anotar"}
          </button>
        </div>
        {error && <p className="mt-1.5 text-[0.7rem] text-bad">{error}</p>}
      </div>

      {/* Linha do tempo */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {events === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vlt-skeleton h-12" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <History className="size-7 text-ink-3" strokeWidth={1.5} />
            <p className="text-xs text-ink-3">Nenhum registro ainda.</p>
          </div>
        ) : (
          <ul className="relative space-y-4 pl-1">
            {/* conector vertical da linha do tempo */}
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[15px] w-px bg-line"
            />
            {events.map((event) => {
              const meta = KIND_META[event.kind] ?? KIND_META.note;
              const Icon = meta.icon;
              return (
                <li key={event.id} className="relative flex gap-3">
                  <span
                    className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line"
                    style={{ background: meta.soft, color: meta.color }}
                  >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    {event.kind === "note" ? (
                      <div className="rounded-xl rounded-tl-sm border border-line bg-panel px-3 py-2">
                        <p className="text-[0.8rem] leading-relaxed whitespace-pre-wrap">
                          {event.message}
                        </p>
                      </div>
                    ) : (
                      <p className="pt-1 text-[0.8rem] font-medium">{meta.label}</p>
                    )}
                    {event.kind !== "note" && event.message && (
                      <p className="mt-0.5 text-[0.72rem] text-ink-2">
                        {event.message}
                      </p>
                    )}
                    <p className="mt-1 text-[0.68rem] text-ink-3">
                      <span className="font-medium text-ink-2">{event.userName}</span>
                      {" · "}
                      <span title={fullWhen(event.createdAt)}>
                        {relativeWhen(event.createdAt)}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
