"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Layers,
  ArrowRight,
  Plus,
} from "lucide-react";
import {
  certStatus,
  daysLeft,
  formatDate,
  STATUS_META,
  type CertStatus,
} from "@/lib/certificates";
import { useCertificates } from "@/lib/useCertificates";
import { useSettings } from "@/lib/settings";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import { maybeNotifyExpiring } from "@/lib/notify";
import ExpiryRing from "@/components/ui/ExpiryRing";
import StatusBadge from "@/components/ui/StatusBadge";

const TILES: {
  status: CertStatus | "all";
  label: string;
  icon: typeof ShieldCheck;
  color: string;
  soft: string;
}[] = [
  { status: "all", label: "No cofre", icon: Layers, color: "var(--info)", soft: "var(--info-soft)" },
  { status: "valid", label: "Válidos", icon: ShieldCheck, color: "var(--ok)", soft: "var(--ok-soft)" },
  { status: "expiring", label: "Vencendo", icon: ShieldAlert, color: "var(--warn)", soft: "var(--warn-soft)" },
  { status: "expired", label: "Vencidos", icon: ShieldX, color: "var(--bad)", soft: "var(--bad-soft)" },
];

export default function DashboardPage() {
  const { certs, ready } = useCertificates();
  const { notifyBrowser } = useSettings();
  const { alertDays } = useVaultConfig();
  const { editor } = useMe();

  useEffect(() => {
    if (notifyBrowser) maybeNotifyExpiring(certs, alertDays);
  }, [certs, alertDays, notifyBrowser]);

  const counts: Record<CertStatus | "all", number> = {
    all: certs.length,
    valid: 0,
    expiring: 0,
    expired: 0,
  };
  for (const c of certs) counts[certStatus(c, alertDays)]++;

  const attention = certs
    .filter((c) => certStatus(c, alertDays) !== "valid")
    .sort((a, b) => daysLeft(a) - daysLeft(b));

  const upcoming = certs
    .filter((c) => certStatus(c, alertDays) === "valid")
    .sort((a, b) => daysLeft(a) - daysLeft(b))
    .slice(0, 3);

  return (
    <div>
      {/* Cabeçalho */}
      <header className="anim-fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="mt-1 text-sm text-ink-2">
            O estado do cofre de certificados digitais, num relance.
          </p>
        </div>
        {editor && (
          <Link href="/certificados?novo=1" className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo certificado
          </Link>
        )}
      </header>

      {/* Tiles de status */}
      <section className="anim-fade-up grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {TILES.map(({ status, label, icon: Icon, color, soft }) => (
          <div key={status} className="vlt-card vlt-card-hover p-5">
            <div className="flex items-center justify-between">
              <span
                className="flex size-9 items-center justify-center rounded-xl"
                style={{ background: soft, color }}
              >
                <Icon className="size-4.5" strokeWidth={1.9} />
              </span>
              {status === "expiring" && (
                <span className="text-[0.65rem] text-ink-3">≤ {alertDays} dias</span>
              )}
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {counts[status]}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ink-3">{label}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Precisa de atenção */}
        <section className="vlt-card anim-fade-up lg:col-span-3" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Precisa de atenção</h2>
            <Link
              href="/certificados"
              className="flex items-center gap-1 text-xs font-medium text-brand hover:opacity-80"
            >
              Ver todos <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {!ready ? (
            <div className="px-6 py-14" />
          ) : attention.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <ShieldCheck className="size-8 text-ok" strokeWidth={1.5} />
              <p className="text-sm text-ink-2">Tudo em dia — nenhum certificado vencendo.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((cert) => (
                <li key={cert.id}>
                  <Link
                    href={`/certificados?cert=${cert.id}`}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-panel-2/60"
                  >
                    <ExpiryRing cert={cert} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{cert.holder}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {cert.type} · vence {formatDate(cert.expiresAt)}
                      </p>
                    </div>
                    <StatusBadge cert={cert} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Próximos vencimentos */}
        <section className="vlt-card anim-fade-up lg:col-span-2" style={{ animationDelay: "180ms" }}>
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Próximos vencimentos</h2>
          </div>
          <ul className="divide-y divide-line">
            {upcoming.map((cert) => {
              const d = daysLeft(cert);
              return (
                <li key={cert.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cert.holder}</p>
                    <p className="mt-0.5 text-xs text-ink-3">{cert.type}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: STATUS_META[certStatus(cert, alertDays)].color }}
                    >
                      {d}d
                    </p>
                    <p className="text-[0.68rem] text-ink-3">{formatDate(cert.expiresAt)}</p>
                  </div>
                </li>
              );
            })}
            {ready && upcoming.length === 0 && (
              <li className="px-6 py-10 text-center text-sm text-ink-3">
                Nenhum certificado válido no cofre.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
