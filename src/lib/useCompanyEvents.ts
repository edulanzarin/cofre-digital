"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEvent } from "@/components/ui/HistoryPanel";

// A linha do tempo da empresa é carregada uma vez pela página: as fixadas
// aparecem no topo do cofre (em qualquer aba) e a lista inteira na aba de
// anotações. Duas buscas para a mesma coisa deixariam as duas fora de
// sincronia assim que alguém fixasse um recado.
export function useCompanyEvents(companyId: string) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/companies/${companyId}/events`)
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
  }, [companyId]);

  const addNote = useCallback(
    async (message: string, pinned: boolean) => {
      const res = await fetch(`/api/companies/${companyId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pinned }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar a anotação.");
      }
      const created = (await res.json()) as HistoryEvent;
      setEvents((prev) => [created, ...(prev ?? [])]);
    },
    [companyId],
  );

  const togglePin = useCallback(
    async (event: HistoryEvent) => {
      const res = await fetch(`/api/companies/${companyId}/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !event.pinned }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao fixar a anotação.");
      }
      const updated = (await res.json()) as HistoryEvent;
      setEvents((prev) => (prev ?? []).map((e) => (e.id === updated.id ? updated : e)));
    },
    [companyId],
  );

  // Fixadas da mais nova para a mais velha, como o resto da linha do tempo.
  const pinned = useMemo(
    () => (events ?? []).filter((e) => e.kind === "note" && e.pinned),
    [events],
  );

  return { events, ready: events !== null, pinned, addNote, togglePin };
}
