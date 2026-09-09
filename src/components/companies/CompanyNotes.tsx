"use client";

import {
  HistoryHeader,
  HistoryTimeline,
  NoteComposer,
  type HistoryEvent,
} from "@/components/ui/HistoryPanel";

// Aba de anotações da empresa. Recebe a linha do tempo já carregada pela
// página — é a mesma lista que alimenta os recados fixados lá em cima.
export default function CompanyNotes({
  events,
  onAddNote,
  onTogglePin,
}: {
  events: HistoryEvent[] | null;
  onAddNote: (message: string, pinned: boolean) => Promise<void>;
  onTogglePin: (event: HistoryEvent) => void;
}) {
  return (
    <div className="vlt-card anim-fade-up overflow-hidden" style={{ animationDelay: "100ms" }}>
      <HistoryHeader events={events} />
      <NoteComposer
        placeholder="Alvará solicitado dia 3 para o cliente…"
        pinnable
        onSubmit={onAddNote}
      />
      <div className="px-5 py-4">
        <HistoryTimeline
          events={events}
          createdLabel="Empresa cadastrada"
          onTogglePin={onTogglePin}
        />
      </div>
    </div>
  );
}
