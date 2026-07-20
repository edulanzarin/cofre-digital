"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Vault,
  LayoutGrid,
  Building2,
  ShieldCheck,
  Globe,
  FileBadge,
  Network,
  Users,
  Settings2,
  Sun,
  Moon,
  Lock,
  LogOut,
} from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { lockVault, useVaultConfig } from "@/lib/vaultConfig";
import { logout, useMe } from "@/lib/useMe";
import { SECTOR_LABELS } from "@/lib/sectors";
import { toast } from "@/lib/toast";
import type { ModuleKey } from "@/lib/permissions";

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  module?: ModuleKey; // some do menu sem o nível "view" no módulo
  adminOnly?: boolean;
}[] = [
  { href: "/", label: "Visão geral", icon: LayoutGrid },
  { href: "/empresas", label: "Empresas", icon: Building2, module: "empresas" },
  { href: "/grupos", label: "Grupos", icon: Network, module: "empresas" },
  { href: "/certificados", label: "Certificados", icon: ShieldCheck, module: "certificados" },
  { href: "/acessos", label: "Acessos", icon: Globe, module: "acessos" },
  { href: "/alvaras", label: "Alvarás", icon: FileBadge, module: "alvaras" },
  { href: "/equipe", label: "Equipe", icon: Users, adminOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings2 },
];

// Bloqueio geral: só admins veem e travam o cofre para todos.
function LockPill() {
  const { hasPin } = useVaultConfig();

  return (
    <button
      onClick={() =>
        hasPin &&
        lockVault().catch(() => toast.error("Falha ao bloquear o cofre."))
      }
      disabled={!hasPin}
      title={
        hasPin
          ? "Bloquear o cofre para todos os setores"
          : "Defina um PIN nas configurações para poder bloquear"
      }
      className="mb-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-panel-2/60 px-3 py-2 transition-colors enabled:hover:border-line-strong disabled:cursor-default max-lg:hidden"
    >
      <span className="flex items-center gap-1.5 text-[0.72rem] text-ink-3">
        <Lock className="size-3 text-ok" />
        {hasPin ? "Bloquear cofre" : "Cofre sem PIN"}
      </span>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-ok" />
      </span>
    </button>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  const light = theme === "light";

  return (
    <button
      onClick={() => setTheme(light ? "dark" : "light")}
      className="vlt-icon-btn"
      title={light ? "Modo noturno" : "Modo claro"}
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { me, admin, can } = useMe();
  const items = NAV.filter((item) => {
    if (item.adminOnly) return admin;
    if (item.module) return can(item.module);
    return true;
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-sidebar max-lg:w-16">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3 max-lg:justify-center max-lg:px-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand shadow-(--brand-glow)">
          <Vault className="size-5" strokeWidth={1.8} />
        </div>
        <div className="max-lg:hidden">
          <p className="text-sm leading-tight font-semibold tracking-tight">
            Cofre Digital
          </p>
          <p className="text-[0.68rem] text-ink-3">Navecon</p>
        </div>
      </div>

      <div className="mx-4 my-2 h-px bg-line max-lg:mx-3" />

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-3 pt-1 max-lg:px-2.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.83rem] font-medium transition-colors max-lg:justify-center max-lg:px-0 max-lg:py-2.5 ${
                active
                  ? "bg-brand-soft text-brand"
                  : "text-ink-2 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {active && (
                <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand max-lg:hidden" />
              )}
              <Icon className="size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="max-lg:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="px-3 pb-3 max-lg:px-2.5">
        {admin && <LockPill />}
        <div className="flex items-center justify-between gap-1 max-lg:flex-col">
          <div className="flex min-w-0 items-center gap-2 px-1 max-lg:px-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-strong text-[0.7rem] font-bold text-white">
              {(me?.name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 max-lg:hidden">
              <p className="truncate text-xs font-medium">{me?.name ?? "…"}</p>
              <p className="truncate text-[0.65rem] text-ink-3">
                {me ? SECTOR_LABELS[me.sector] : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center max-lg:flex-col">
            <ThemeToggle />
            <button
              onClick={() => logout()}
              className="vlt-icon-btn hover:!bg-bad-soft hover:!text-bad"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
