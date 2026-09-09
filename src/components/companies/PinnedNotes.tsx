"use client";

import { Pin, PinOff } from "lucide-react";
import {
  fullWhen,
  relativeWhen,
  type HistoryEvent,
} from "@/components/ui/HistoryPanel";

// Recados fixados da empresa, no topo do cofre e fora das abas: quem abre a
// empresa para ver certificado precisa esbarrar no "alvará já foi solicitado"
// sem ir procurar. Sem nenhum fixado, o bloco não existe.
export default function PinnedNotes({
  notes,
  onUnpin,
}: {
  notes: HistoryEvent[];
  onUnpin: (note: HistoryEvent) => void;
}) {
  if (notes.length === 0) return null;

  return (
    <section className="vlt-card mb-5 overflow-hidden">
      <div className="flex items-center gap-1.5 bg-brand-soft px-5 py-2 text-brand">
        <Pin className="size-3.5" />
        <p className="text-xs font-semibold tracking-tight">Fixado</p>
        {notes.length > 1 && (
          <span className="text-[0.68rem] opacity-80">· {notes.length}</span>
        )}
      </div>
      <ul className="divide-y divide-line">
        {notes.map((note) => (
          <li key={note.id} className="flex items-start gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.85rem] leading-relaxed whitespace-pre-wrap">
                {note.message}
              </p>
              <p className="mt-1 text-[0.68rem] text-ink-3">
                <span className="font-medium text-ink-2">{note.userName}</span>
                {" · "}
                <span title={fullWhen(note.createdAt)}>
                  {relativeWhen(note.createdAt)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUnpin(note)}
              className="vlt-icon-btn shrink-0"
              title="Soltar do topo"
            >
              <PinOff className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
