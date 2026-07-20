"use client";

import { useCallback, useEffect, useState } from "react";

// Espelha um pedaço de estado da tela (busca, filtro) num parâmetro da URL:
// o link fica compartilhável e recarregar a página não perde o contexto.
//
// Usa history.replaceState em vez de router.replace do Next — o router
// quebra no build de produção nesse caso (ver nota no Brain) e ainda
// remontaria a página a cada tecla digitada.
// NoInfer no fallback: o tipo sai da lista `allowed` (ou é `string` puro
// quando não há lista). Sem isso, useUrlState("q", "") fecharia T em `""`.
export function useUrlState<T extends string = string>(
  key: string,
  fallback: NoInfer<T>,
  allowed?: readonly T[],
) {
  const [value, setValue] = useState<T>(fallback);

  // Lê a URL só depois de montar: ler no initializer faria o HTML do
  // servidor (que não enxerga a query) divergir do cliente na hidratação.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    if (raw === null) return;
    if (allowed && !allowed.includes(raw as T)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(raw as T);
    // `allowed` costuma ser um literal inline; comparar por conteúdo evitaria
    // relê-la a cada render, mas a sincronização é one-shot de qualquer forma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      // O valor padrão sai da URL: link limpo quando nada foi filtrado.
      if (next && next !== fallback) params.set(key, next);
      else params.delete(key);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    },
    [key, fallback],
  );

  return [value, set] as const;
}
