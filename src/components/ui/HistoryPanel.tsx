"use client";

import { useEffect, useState } from "react";
import {
  History,
  MessageSquareText,
  PencilLine,
  Pin,
  PinOff,
  PlusCircle,
  Send,
} from "lucide-react";

// Evento da linha do tempo — mesmo shape nas APIs de certificados, alvarás
// e empresas. `pinned` só existe onde a anotação pode ficar em destaque.
export type HistoryEvent = {
  id: string;
  kind: "created" | "updated" | "note";
  message?: string;
  pinned?: boolean;
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
export function relativeWhen(iso: string): string {
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

export function fullWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Campo de anotação. Com `pinnable`, quem escreve já decide se o recado
// nasce fixado — fixar depois seria um segundo passo fácil de esquecer.
export function NoteComposer({
  placeholder,
  pinnable = false,
  onSubmit,
}: {
  placeholder: string;
  pinnable?: boolean;
  onSubmit: (message: string, pinned: boolean) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [pinned, setPinned] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      await onSubmit(text, pinned);
      setMessage("");
      setPinned(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a anotação.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-b border-line px-5 py-3.5">
      <textarea
        className="vlt-input min-h-16 w-full resize-y text-[0.82rem]"
        placeholder={placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {pinnable ? (
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-pressed={pinned}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] transition-colors ${
              pinned ? "" : "text-ink-3 hover:text-ink-2"
            }`}
            style={
              pinned ? { background: "var(--brand-soft)", color: "var(--brand)" } : undefined
            }
          >
            <Pin className="size-3.5" />
            {pinned ? "Vai ficar fixada no topo" : "Fixar no topo"}
          </button>
        ) : (
          <p className="text-[0.65rem] text-ink-3">
            Fica registrado com seu nome e a data.
          </p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={!message.trim() || sending}
          className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
        >
          <Send className="size-3.5" />
          {sending ? "Salvando…" : "Anotar"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[0.7rem] text-bad">{error}</p>}
    </div>
  );
}

// A linha do tempo em si: cadastro, alterações e anotações, do mais novo
// para o mais velho. `onTogglePin` liga o alfinete nas anotações.
export function HistoryTimeline({
  events,
  createdLabel,
  onTogglePin,
}: {
  events: HistoryEvent[] | null;
  createdLabel?: string;
  onTogglePin?: (event: HistoryEvent) => void;
}) {
  if (events === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="vlt-skeleton h-12" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <History className="size-7 text-ink-3" strokeWidth={1.5} />
        <p className="text-xs text-ink-3">Nenhum registro ainda.</p>
      </div>
    );
  }

  return (
    <ul className="relative space-y-4 pl-1">
      {/* conector vertical da linha do tempo */}
      <span aria-hidden className="absolute top-2 bottom-2 left-[15px] w-px bg-line" />
      {events.map((event) => {
        const meta = KIND_META[event.kind] ?? KIND_META.note;
        const Icon = meta.icon;
        const label = event.kind === "created" ? (createdLabel ?? meta.label) : meta.label;
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
                <div
                  className="rounded-xl rounded-tl-sm border bg-panel px-3 py-2"
                  style={{
                    borderColor: event.pinned ? "var(--brand)" : "var(--line)",
                  }}
                >
                  <p className="text-[0.8rem] leading-relaxed whitespace-pre-wrap">
                    {event.message}
                  </p>
                </div>
              ) : (
                <p className="pt-1 text-[0.8rem] font-medium">{label}</p>
              )}
              {event.kind !== "note" && event.message && (
                <p className="mt-0.5 text-[0.72rem] leading-relaxed whitespace-pre-line text-ink-2">
                  {event.message}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <p className="text-[0.68rem] text-ink-3">
                  <span className="font-medium text-ink-2">{event.userName}</span>
                  {" · "}
                  <span title={fullWhen(event.createdAt)}>
                    {relativeWhen(event.createdAt)}
                  </span>
                </p>
                {onTogglePin && event.kind === "note" && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(event)}
                    className={`flex items-center gap-1 text-[0.68rem] transition-colors ${
                      event.pinned ? "" : "text-ink-3 hover:text-ink-2"
                    }`}
                    style={event.pinned ? { color: "var(--brand)" } : undefined}
                    title={event.pinned ? "Soltar do topo" : "Fixar no topo"}
                  >
                    {event.pinned ? (
                      <>
                        <PinOff className="size-3" />
                        Soltar
                      </>
                    ) : (
                      <>
                        <Pin className="size-3" />
                        Fixar
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Cabeçalho com a contagem — igual nos dois usos do histórico.
export function HistoryHeader({ events }: { events: HistoryEvent[] | null }) {
  const noteCount = events?.filter((e) => e.kind === "note").length ?? 0;
  return (
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
  );
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

  async function addNote(message: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao salvar a observação.");
    }
    const created = (await res.json()) as HistoryEvent;
    setEvents((prev) => [created, ...(prev ?? [])]);
  }

  return (
    <>
      <HistoryHeader events={events} />
      <NoteComposer placeholder={placeholder} onSubmit={addNote} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <HistoryTimeline events={events} />
      </div>
    </>
  );
}
