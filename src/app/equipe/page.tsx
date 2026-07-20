"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  Search,
  KeyRound,
  Crown,
} from "lucide-react";
import { SECTOR_LABELS, SECTORS, type SectorKey, type TeamUser } from "@/lib/sectors";
import {
  LEVEL_LABELS,
  LEVELS,
  MODULE_LABELS,
  MODULES,
  type Level,
  type PermissionRules,
  type Profile,
} from "@/lib/permissions";
import { useMe } from "@/lib/useMe";
import { toast } from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";

type Tab = "usuarios" | "perfis";

export default function TeamPage() {
  const { me, admin } = useMe();
  const [tab, setTab] = useState<Tab>("usuarios");
  const [profiles, setProfiles] = useState<Profile[] | null>(null);

  // Perfis são usados nas duas abas (badge do usuário e gestão).
  useEffect(() => {
    if (!admin) return;
    let active = true;
    fetch("/api/profiles")
      .then((r) => (r.ok ? (r.json() as Promise<Profile[]>) : []))
      .then((data) => {
        if (active) setProfiles(data);
      })
      .catch(() => {
        if (active) setProfiles([]);
      });
    return () => {
      active = false;
    };
  }, [admin]);

  if (me && !admin) {
    return (
      <div className="vlt-card mx-auto mt-20 max-w-md px-6 py-12 text-center">
        <ShieldCheck className="mx-auto size-8 text-ink-3" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-ink-2">
          Apenas administradores gerenciam a equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="anim-fade-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
        <div className="vlt-segment">
          <button data-active={tab === "usuarios"} onClick={() => setTab("usuarios")}>
            <Users className="size-3.5" />
            Usuários
          </button>
          <button data-active={tab === "perfis"} onClick={() => setTab("perfis")}>
            <KeyRound className="size-3.5" />
            Perfis de acesso
          </button>
        </div>
      </header>

      {tab === "usuarios" ? (
        <UsersTab meEmail={me?.email} profiles={profiles ?? []} />
      ) : (
        <ProfilesTab profiles={profiles} setProfiles={setProfiles} />
      )}
    </div>
  );
}

// ============================================================
// Aba Usuários
// ============================================================

function UsersTab({
  meEmail,
  profiles,
}: {
  meEmail?: string;
  profiles: Profile[];
}) {
  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.profileName?.toLowerCase().includes(q) ?? false),
    );
  }, [users, query]);

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
      toast.error(body?.error ?? "Falha ao excluir.");
      return;
    }
    setUsers((prev) => (prev ?? []).filter((u) => u.id !== id));
    setDeleting(null);
    toast.success("Usuário removido.");
  }

  return (
    <div>
      <div
        className="anim-fade-up mb-5 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "40ms" }}
      >
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="vlt-input pl-9"
            placeholder="Buscar por nome, e-mail ou perfil…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button onClick={() => setModal("new")} className="vlt-btn vlt-btn-primary">
          <Plus className="size-4" />
          Novo usuário
        </button>
      </div>

      {users === null ? (
        <div className="vlt-skeleton h-40" />
      ) : filtered.length === 0 ? (
        <div className="vlt-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Users className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">
            {users.length === 0
              ? "Nenhum usuário cadastrado."
              : "Ninguém encontrado com essa busca."}
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
                  {meEmail === user.email && (
                    <span className="ml-2 text-[0.65rem] text-ink-3">(você)</span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-3">
                  {user.email} · {SECTOR_LABELS[user.sector]}
                </p>
              </div>
              <span
                className={`vlt-badge shrink-0 ${
                  user.profileAdmin
                    ? "bg-brand-soft text-brand"
                    : "bg-panel-2 text-ink-2"
                }`}
              >
                {user.profileAdmin && <Crown className="size-3" />}
                {user.profileName ?? "Sem perfil"}
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
                  {meEmail !== user.email && (
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
          subtitle={
            modal === "edit"
              ? editing?.email
              : "O perfil de acesso define o que a pessoa pode fazer."
          }
          onClose={() => setModal("closed")}
        >
          <UserForm
            initial={modal === "edit" ? (editing ?? undefined) : undefined}
            profiles={profiles}
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
  profiles,
  onDone,
  onCancel,
}: {
  initial?: TeamUser;
  profiles: Profile[];
  onDone: (user: TeamUser) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [sector, setSector] = useState<SectorKey>(initial?.sector ?? "FISCAL");
  const [profileId, setProfileId] = useState(initial?.profileId ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const profile = profiles.find((p) => p.id === profileId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = initial
      ? await fetch(`/api/users/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            sector,
            profileId,
            password: password || undefined,
          }),
        })
      : await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, sector, profileId, password }),
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

      <Field label="Perfil de acesso">
        <select
          className="vlt-input"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          required
        >
          <option value="" disabled>
            Escolha o perfil…
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.admin ? " (administrador)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {profile &&
        (profile.admin ? (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
            Administrador: edita tudo, gerencia a equipe, os perfis e o bloqueio
            do cofre.
          </p>
        ) : (
          <p className="rounded-lg bg-panel-2 px-3 py-2 text-xs text-ink-2">
            {MODULES.map(
              (m) => `${MODULE_LABELS[m]}: ${LEVEL_LABELS[profile.rules[m] ?? "none"]}`,
            ).join(" · ")}
          </p>
        ))}

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

// ============================================================
// Aba Perfis de acesso
// ============================================================

function ProfilesTab({
  profiles,
  setProfiles,
}: {
  profiles: Profile[] | null;
  setProfiles: React.Dispatch<React.SetStateAction<Profile[] | null>>;
}) {
  const [modal, setModal] = useState<"closed" | "new" | "edit">("closed");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Falha ao excluir.");
      setDeleting(null);
      return;
    }
    setProfiles((prev) => (prev ?? []).filter((p) => p.id !== id));
    setDeleting(null);
    toast.success("Perfil removido.");
  }

  return (
    <div>
      <div className="anim-fade-up mb-5 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          Um perfil é um padrão de permissões — crie uma vez, aplique a quantos
          usuários quiser.
        </p>
        <button
          onClick={() => setModal("new")}
          className="vlt-btn vlt-btn-primary shrink-0"
        >
          <Plus className="size-4" />
          Novo perfil
        </button>
      </div>

      {profiles === null ? (
        <div className="vlt-skeleton h-40" />
      ) : profiles.length === 0 ? (
        <div className="vlt-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <KeyRound className="size-8 text-ink-3" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">Nenhum perfil criado ainda.</p>
        </div>
      ) : (
        <ul className="anim-fade-up space-y-3" style={{ animationDelay: "60ms" }}>
          {profiles.map((profile) => (
            <li key={profile.id} className="vlt-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {profile.admin && <Crown className="size-3.5 text-brand" />}
                    {profile.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {profile.userCount === 0
                      ? "Nenhum usuário"
                      : profile.userCount === 1
                        ? "1 usuário"
                        : `${profile.userCount} usuários`}
                  </p>
                </div>
                {deleting === profile.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setDeleting(null)}
                      className="vlt-btn vlt-btn-ghost !px-2.5 !py-1 text-xs"
                    >
                      Não
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="vlt-btn vlt-btn-danger !px-2.5 !py-1 text-xs"
                    >
                      Excluir
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => {
                        setEditing(profile);
                        setModal("edit");
                      }}
                      className="vlt-icon-btn"
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(profile.id)}
                      className="vlt-icon-btn hover:!bg-bad-soft hover:!text-bad"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {profile.admin ? (
                  <span className="vlt-badge bg-brand-soft text-brand">
                    Acesso total + gestão da equipe
                  </span>
                ) : (
                  MODULES.map((m) => {
                    const level = profile.rules[m] ?? "none";
                    return (
                      <span
                        key={m}
                        className={`vlt-badge ${
                          level === "edit"
                            ? "bg-ok-soft text-ok"
                            : level === "view"
                              ? "bg-panel-2 text-ink-2"
                              : "bg-panel-2 text-ink-3 line-through opacity-60"
                        }`}
                      >
                        {MODULE_LABELS[m]}: {LEVEL_LABELS[level]}
                      </span>
                    );
                  })
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal !== "closed" && (
        <Modal
          title={modal === "edit" ? "Editar perfil" : "Novo perfil de acesso"}
          subtitle={
            modal === "edit"
              ? editing?.name
              : "Defina o nível por módulo e aplique aos usuários."
          }
          onClose={() => setModal("closed")}
        >
          <ProfileForm
            initial={modal === "edit" ? (editing ?? undefined) : undefined}
            onDone={(profile) => {
              setProfiles((prev) => {
                const list = prev ?? [];
                const exists = list.some((p) => p.id === profile.id);
                const next = exists
                  ? list.map((p) => (p.id === profile.id ? profile : p))
                  : [...list, profile];
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

function ProfileForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Profile;
  onDone: (profile: Profile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [admin, setAdmin] = useState(initial?.admin ?? false);
  const [rules, setRules] = useState<PermissionRules>(() => {
    const base: PermissionRules = {};
    for (const m of MODULES) base[m] = initial?.rules[m] ?? "view";
    return base;
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = initial
      ? await fetch(`/api/profiles/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, admin, rules }),
        })
      : await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, admin, rules }),
        });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Falha ao salvar.");
      return;
    }
    onDone((await res.json()) as Profile);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome do perfil">
        <input
          className="vlt-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Fiscal — edita acessos"
          required
          autoFocus
        />
      </Field>

      <Switch
        label="Administrador"
        description="Edita tudo e gerencia equipe, perfis e bloqueio do cofre."
        checked={admin}
        onChange={setAdmin}
      />

      {!admin && (
        <div className="space-y-1 rounded-xl border border-line bg-panel-2/50 px-4 py-1">
          {MODULES.map((m) => (
            <div key={m} className="flex items-center justify-between gap-4 py-2.5">
              <p className="text-sm">{MODULE_LABELS[m]}</p>
              <div className="vlt-segment">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    data-active={(rules[m] ?? "none") === level}
                    onClick={() => setRules((r) => ({ ...r, [m]: level }))}
                  >
                    {LEVEL_LABELS[level as Level]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-bad">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="vlt-btn vlt-btn-primary">
          {initial ? "Salvar alterações" : "Criar perfil"}
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
