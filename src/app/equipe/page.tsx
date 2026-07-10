"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, ShieldCheck, Search } from "lucide-react";
import { SECTOR_LABELS, SECTORS, type SectorKey, type TeamUser } from "@/lib/sectors";
import { useMe } from "@/lib/useMe";
import Modal from "@/components/ui/Modal";

export default function TeamPage() {
  const { me, editor } = useMe();
  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<"all" | SectorKey>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (sectorFilter === "all" || u.sector === sectorFilter) &&
        (!q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    );
  }, [users, query, sectorFilter]);

  useEffect(() => {
    let active = true;
    fetch("/api/users")
      .then((r) => (r.ok ? (r.json() as Promise<TeamUser[]>) : []))
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch(() => {
        if (active) setUsers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(body?.error ?? "Falha ao excluir.");
      return;
    }
    setUsers((prev) => (prev ?? []).filter((u) => u.id !== id));
    setDeleting(null);
  }

  if (me && !editor) {
    return (
      <div className="vlt-card mx-auto mt-20 max-w-md px-6 py-12 text-center">
        <ShieldCheck className="mx-auto size-8 text-ink-3" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-ink-2">
          Apenas o setor Societário gerencia a equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-ink-2">
            Quem acessa o cofre e de qual setor. Societário edita; os demais leem.
          </p>
        </div>
        <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
          <Plus className="size-4" />
          Novo usuário
        </button>
      </header>

      {/* Busca + filtro por setor */}
      <div
        className="anim-fade-up mb-5 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "40ms" }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por nome ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="vlt-input !w-48"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value as "all" | SectorKey)}
        >
          <option value="all">Todos os setores</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {users === null ? (
        <div className="vlt-card h-40 animate-pulse bg-panel-2/40" />
      ) : filtered.length === 0 ? (
        <div className="vlt-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Users className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {users.length === 0
              ? "Nenhum usuário cadastrado."
              : "Ninguém encontrado com esses filtros."}
          </p>
        </div>
      ) : (
        <ul className="vlt-card anim-fade-up divide-y divide-line" style={{ animationDelay: "60ms" }}>
          {filtered.map((user) => (
            <li key={user.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-strong text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name}
                  {me?.email === user.email && (
                    <span className="ml-2 text-[0.65rem] text-ink-3">(você)</span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-3">{user.email}</p>
              </div>
              <span
                className={`vlt-badge ${
                  user.sector === "SOCIETARIO"
                    ? "bg-brand-soft text-brand"
                    : "bg-panel-2 text-ink-2"
                }`}
              >
                {SECTOR_LABELS[user.sector]}
              </span>
              {deleting === user.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeleting(null)}
                    className="vlt-btn vlt-btn-ghost !px-2.5 !py-1 text-xs"
                  >
                    Não
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="vlt-btn vlt-btn-danger !px-2.5 !py-1 text-xs"
                  >
                    Excluir
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setEditing(user);
                      setModal("edit");
                    }}
                    className="vlt-icon-btn"
                    title="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  {me?.email !== user.email && (
                    <button
                      onClick={() => setDeleting(user.id)}
                      className="vlt-icon-btn hover:!bg-bad-soft hover:!text-bad"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {modal !== "closed" && (
        <Modal
          title={modal === "edit" ? "Editar usuário" : "Novo usuário"}
          subtitle={modal === "edit" ? editing?.email : "Acesso ao cofre por setor."}
          onClose={() => setModal("closed")}
        >
          <UserForm
            initial={modal === "edit" ? (editing ?? undefined) : undefined}
            onDone={(user) => {
              setUsers((prev) => {
                const list = prev ?? [];
                const exists = list.some((u) => u.id === user.id);
                const next = exists
                  ? list.map((u) => (u.id === user.id ? user : u))
                  : [...list, user];
                return next.sort((a, b) => a.name.localeCompare(b.name));
              });
              setModal("closed");
            }}
            onCancel={() => setModal("closed")}
          />
        </Modal>
      )}
    </div>
  );
}

function UserForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: TeamUser;
  onDone: (user: TeamUser) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [sector, setSector] = useState<SectorKey>(initial?.sector ?? "FISCAL");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = initial
      ? await fetch(`/api/users/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, sector, password: password || undefined }),
        })
      : await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, sector, password }),
        });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Falha ao salvar.");
      return;
    }
    onDone((await res.json()) as TeamUser);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome">
        <input
          className="vlt-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </Field>
      {!initial && (
        <Field label="E-mail">
          <input
            type="email"
            className="vlt-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Setor">
          <select
            className="vlt-input"
            value={sector}
            onChange={(e) => setSector(e.target.value as SectorKey)}
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={initial ? "Nova senha (opcional)" : "Senha"}>
          <input
            type="password"
            className="vlt-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required={!initial}
            minLength={6}
          />
        </Field>
      </div>

      {sector === "SOCIETARIO" ? (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
          Societário pode cadastrar, editar, excluir e revelar senhas.
        </p>
      ) : (
        <p className="rounded-lg bg-panel-2 px-3 py-2 text-xs text-ink-2">
          {SECTOR_LABELS[sector]} só visualiza, copia senhas e baixa arquivos.
        </p>
      )}

      {error && <p className="text-xs text-bad">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="vlt-btn vlt-btn-primary">
          {initial ? "Salvar alterações" : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
