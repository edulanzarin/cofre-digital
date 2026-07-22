"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export type ComboOption = {
  value: string;
  label: string;
  hint?: string; // contagem, CNPJ… some da busca, aparece à direita
  manageable?: boolean; // ganha renomear/excluir no painel (grupos de verdade)
};

// Ignora acento e caixa: "sao" acha "São".
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Seletor com busca, para listas que crescem sem teto (grupos de empresas,
// onde cada cliente pode virar um). Um <select> nativo obrigaria a rolar
// centenas de linhas; aqui digita-se o nome.
//
// Além de escolher, o combobox pode CRIAR um item (digite um nome novo →
// "Criar «nome»") e GERENCIAR os existentes (renomear/excluir direto no
// painel) — foi assim que a antiga aba de grupos deixou de existir: o grupo
// passou a nascer e ser mantido de onde ele já é usado.
//
// O painel é portal no body: dentro do modal o `overflow-y-auto` do corpo
// cortaria a lista.
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
  searchPlaceholder = "Buscar…",
  icon,
  className = "",
  onCreate,
  createLabel = "Criar",
  onRename,
  onDelete,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  className?: string;
  // Digitar um nome que não existe oferece criá-lo; devolve o value criado.
  onCreate?: (name: string) => Promise<string>;
  createLabel?: string;
  // Habilitam gerenciar itens com `manageable` direto no painel.
  onRename?: (value: string, name: string) => Promise<void>;
  onDelete?: (value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ value: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    return options.filter((o) => fold(o.label).includes(q));
  }, [options, query]);

  const trimmed = query.trim();
  const showCreate =
    Boolean(onCreate) &&
    trimmed !== "" &&
    !options.some((o) => fold(o.label) === fold(trimmed));

  // Reabrir começa limpo, com o item atual em foco. Feito na abertura e não
  // num efeito: a medida do gatilho só faz sentido no gesto que abre.
  function openPanel() {
    setQuery("");
    setEditing(null);
    setConfirmDelete(null);
    const i = options.findIndex((o) => o.value === value);
    setActive(i < 0 ? 0 : i);
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    // Rolar a página moveria o painel para longe do campo; fechar é mais
    // honesto do que reposicionar a cada frame. Mas o scroll da própria
    // lista não conta — navegar de seta rola o <ul> e fecharia o painel
    // no meio da escolha (a escuta é em captura, então pega tudo).
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Mantém o item ativo visível quando se navega pelo teclado.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(option: ComboOption) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function create() {
    if (!onCreate || !trimmed || busy) return;
    setBusy(true);
    try {
      const created = await onCreate(trimmed);
      onChange(created);
      setOpen(false);
      triggerRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!onRename || !editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onRename(editing.value, name);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(v: string) {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(v);
      if (value === v) onChange(""); // filtro apontava pro grupo excluído
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + filtered.length) % filtered.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) {
        const option = filtered[active];
        if (option) pick(option);
      } else if (showCreate) {
        create();
      }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`vlt-input flex items-center gap-2 text-left ${className}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            openPanel();
          }
        }}
      >
        {icon}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-ink-3"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-ink-3 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="vlt-card anim-pop fixed z-50 overflow-hidden shadow-(--shadow-float)"
            style={{
              top: rect.bottom + 6,
              left: rect.left,
              width: Math.max(rect.width, 240),
            }}
          >
            <div className="relative border-b border-line">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                className="w-full bg-transparent py-2.5 pr-3 pl-9 text-sm outline-none"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                autoFocus
              />
            </div>

            {filtered.length === 0 && !showCreate ? (
              <p className="px-3 py-6 text-center text-xs text-ink-3">
                Nada encontrado.
              </p>
            ) : (
              <ul ref={listRef} className="max-h-64 overflow-y-auto py-1">
                {filtered.map((option, i) => {
                  const isEditing = editing?.value === option.value;
                  const isConfirming = confirmDelete === option.value;
                  const canManage =
                    option.manageable && (Boolean(onRename) || Boolean(onDelete));

                  if (isEditing) {
                    return (
                      <li key={option.value} className="flex items-center gap-1 px-2 py-1">
                        <input
                          className="vlt-input h-8 flex-1 text-sm"
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ value: option.value, name: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveRename();
                            }
                            if (e.key === "Escape") setEditing(null);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="vlt-icon-btn"
                          title="Salvar"
                          disabled={busy || !editing.name.trim()}
                          onClick={saveRename}
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="vlt-icon-btn"
                          title="Cancelar"
                          onClick={() => setEditing(null)}
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={option.value} className="group/opt flex items-center">
                      <button
                        type="button"
                        data-active={i === active}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-ink-2 data-[active=true]:bg-panel-2 data-[active=true]:text-ink"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(option)}
                      >
                        <Check
                          className={`size-3.5 shrink-0 text-brand ${
                            option.value === value ? "" : "invisible"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {option.hint && (
                          <span className="shrink-0 text-[0.7rem] text-ink-3">
                            {option.hint}
                          </span>
                        )}
                      </button>

                      {canManage &&
                        (isConfirming ? (
                          <span className="flex shrink-0 items-center gap-1 pr-2 text-[0.7rem] text-ink-3">
                            Excluir?
                            <button
                              type="button"
                              className="vlt-icon-btn hover:!text-bad"
                              title="Confirmar exclusão"
                              disabled={busy}
                              onClick={() => doDelete(option.value)}
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              className="vlt-icon-btn"
                              title="Cancelar"
                              onClick={() => setConfirmDelete(null)}
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 transition-opacity group-hover/opt:opacity-100">
                            {onRename && (
                              <button
                                type="button"
                                className="vlt-icon-btn"
                                title="Renomear grupo"
                                onClick={() =>
                                  setEditing({ value: option.value, name: option.label })
                                }
                              >
                                <Pencil className="size-3" />
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                className="vlt-icon-btn hover:!text-bad"
                                title="Excluir grupo"
                                onClick={() => setConfirmDelete(option.value)}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </span>
                        ))}
                    </li>
                  );
                })}

                {showCreate && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-brand disabled:opacity-60"
                      disabled={busy}
                      onClick={create}
                    >
                      <Plus className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {createLabel} “{trimmed}”
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
