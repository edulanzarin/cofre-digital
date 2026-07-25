"use client";

import { useCallback, useEffect, useState } from "react";
import { CornerLeftUp, Folder, HardDrive, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { browseStorage, type FolderListing } from "@/lib/vaultConfig";

// Navega as pastas DO SERVIDOR e devolve a escolhida. Não é o seletor nativo do
// SO (esse abriria a máquina do navegador, não a do servidor) — lê o filesystem
// real via API, então mostra "/…" no Linux e os drives no Windows sem ajuste.
export default function FolderPicker({
  initialPath,
  onPick,
  onClose,
}: {
  initialPath?: string;
  onPick: (path: string) => void;
  onClose: () => void;
}) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError("");
    try {
      setListing(await browseStorage(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao listar as pastas.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega a listagem inicial ao abrir — fetch de mount, efeito legítimo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(initialPath || undefined);
  }, [load, initialPath]);

  const atRoots = listing?.path === "";
  const current = listing?.path ?? "";

  return (
    <Modal
      title="Escolher pasta"
      subtitle={atRoots ? "Selecione um drive" : current || "Carregando…"}
      onClose={onClose}
    >
      <div className="space-y-3">
        {/* Subir de nível */}
        {listing && listing.parent !== null && (
          <button
            onClick={() => load(listing.parent || undefined)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-panel-2"
          >
            <CornerLeftUp className="size-4 shrink-0 text-ink-3" />
            Subir um nível
          </button>
        )}

        <div className="max-h-[46vh] min-h-32 overflow-y-auto rounded-xl border border-line">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-ink-3">
              <Loader2 className="size-4 animate-spin" />
              Lendo pastas…
            </div>
          ) : error ? (
            <p className="px-4 py-12 text-center text-xs text-bad">{error}</p>
          ) : listing && listing.entries.length > 0 ? (
            <ul className="divide-y divide-line">
              {listing.entries.map((e) => (
                <li key={e.path}>
                  <button
                    onClick={() => load(e.path)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-panel-2"
                  >
                    {atRoots ? (
                      <HardDrive className="size-4 shrink-0 text-ink-3" />
                    ) : (
                      <Folder className="size-4 shrink-0 text-brand" strokeWidth={1.8} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-12 text-center text-xs text-ink-3">
              Nenhuma subpasta aqui.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="min-w-0 flex-1 truncate font-mono text-[0.7rem] text-ink-3">
            {atRoots ? "" : current}
          </p>
          <div className="flex shrink-0 gap-2">
            <button onClick={onClose} className="vlt-btn vlt-btn-ghost !px-3 !py-1.5 text-xs">
              Cancelar
            </button>
            <button
              onClick={() => onPick(current)}
              disabled={atRoots || !current}
              className="vlt-btn vlt-btn-primary !px-3 !py-1.5 text-xs"
              title="Usa a pasta aberta agora"
            >
              Usar esta pasta
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
