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
  docGroup,
  formatDate,
  STATUS_META,
  type Certificate,
  type CertStatus,
} from "@/lib/certificates";
import { useCertificates } from "@/lib/useCertificates";
import { useSettings } from "@/lib/settings";
import { useVaultConfig } from "@/lib/vaultConfig";
import { useMe } from "@/lib/useMe";
import { maybeNotifyExpiring } from "@/lib/notify";

type Counts = { total: number; valid: number; expiring: number; expired: number };

function countOf(certs: Certificate[], alertDays: number): Counts {
  const counts: Counts = { total: certs.length, valid: 0, expiring: 0, expired: 0 };
  for (const c of certs) counts[certStatus(c, alertDays)]++;
  return counts;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function DashboardPage() {
  const { certs, ready } = useCertificates();
  const { notifyBrowser } = useSettings();
  const { alertDays } = useVaultConfig();
  const { can } = useMe();

  useEffect(() => {
    if (notifyBrowser) maybeNotifyExpiring(certs, alertDays);
  }, [certs, alertDays, notifyBrowser]);

  const all = countOf(certs, alertDays);
  const cnpjCerts = certs.filter((c) => docGroup(c) === "cnpj");
  const cpfCerts = certs.filter((c) => docGroup(c) === "cpf");

  const expiring = certs
    .filter((c) => certStatus(c, alertDays) === "expiring")
    .sort((a, b) => daysLeft(a) - daysLeft(b));

  const expired = certs
    .filter((c) => certStatus(c, alertDays) === "expired")
    .sort((a, b) => daysLeft(b) - daysLeft(a)); // vencidos mais recentes primeiro

  const TILES: {
    key: keyof Counts;
    label: string;
    detail: string;
    icon: typeof ShieldCheck;
    color: string;
    soft: string;
  }[] = [
    {
      key: "total",
      label: "Total de certificados",
      detail: `${cnpjCerts.length} CNPJ · ${cpfCerts.length} CPF`,
      icon: Layers,
      color: "var(--info)",
      soft: "var(--info-soft)",
    },
    {
      key: "expired",
      label: "Vencidos",
      detail: `${pct(all.expired, all.total)} do total`,
      icon: ShieldX,
      color: "var(--bad)",
      soft: "var(--bad-soft)",
    },
    {
      key: "expiring",
      label: "Vencendo em breve",
      detail: `${pct(all.expiring, all.total)} do total`,
      icon: ShieldAlert,
      color: "var(--warn)",
      soft: "var(--warn-soft)",
    },
    {
      key: "valid",
      label: "A vencer",
      detail: `${pct(all.valid, all.total)} do total`,
      icon: ShieldCheck,
      color: "var(--ok)",
      soft: "var(--ok-soft)",
    },
  ];

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
        {can("certificados", "edit") && (
          <Link href="/certificados?novo=1" className="vlt-btn vlt-btn-primary">
            <Plus className="size-4" />
            Novo certificado
          </Link>
        )}
      </header>

      {/* Tiles de status */}
      <section
        className="anim-fade-up grid grid-cols-2 gap-4 lg:grid-cols-4"
        style={{ animationDelay: "60ms" }}
      >
        {TILES.map(({ key, label, detail, icon: Icon, color, soft }) => (
          <div key={key} className="vlt-card vlt-card-hover p-5">
            <div className="flex items-center justify-between">
              <span
                className="flex size-9 items-center justify-center rounded-xl"
                style={{ background: soft, color }}
              >
                <Icon className="size-4.5" strokeWidth={1.9} />
              </span>
              {key === "expiring" && (
                <span className="text-[0.65rem] text-ink-3">≤ {alertDays} dias</span>
              )}
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {all[key]}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ink-3">{label}</p>
            <p className="mt-0.5 text-[0.68rem] text-ink-3">{ready ? detail : "…"}</p>
          </div>
        ))}
      </section>

      {/* e-CNPJ × e-CPF */}
      <section
        className="anim-fade-up mt-6 grid gap-6 lg:grid-cols-2"
        style={{ animationDelay: "120ms" }}
      >
        <GroupCard title="e-CNPJ" certs={cnpjCerts} alertDays={alertDays} />
        <GroupCard title="e-CPF" certs={cpfCerts} alertDays={alertDays} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Próximos a vencer */}
        <ExpiryList
          title="Próximos a vencer"
          icon={<ShieldAlert className="size-4 text-warn" />}
          certs={expiring}
          ready={ready}
          empty="Nenhum certificado vencendo — tudo em dia."
          delay="180ms"
        />

        {/* Vencidos */}
        <ExpiryList
          title="Certificados vencidos"
          icon={<ShieldX className="size-4 text-bad" />}
          certs={expired}
          ready={ready}
          empty="Nenhum certificado vencido no cofre."
          delay="240ms"
        />
      </div>
    </div>
  );
}

// Resumo de um grupo (e-CNPJ ou e-CPF) com barras por situação.
function GroupCard({
  title,
  certs,
  alertDays,
}: {
  title: string;
  certs: Certificate[];
  alertDays: number;
}) {
  const counts = countOf(certs, alertDays);
  const rows: { status: CertStatus; label: string }[] = [
    { status: "expired", label: "Vencidos" },
    { status: "expiring", label: "Vencendo em breve" },
    { status: "valid", label: "A vencer" },
  ];

  return (
    <div className="vlt-card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="text-2xl font-semibold tracking-tight text-brand tabular-nums">
          {counts.total}
        </p>
      </div>
      <div className="mt-4 space-y-3.5">
        {rows.map(({ status, label }) => {
          const n = counts[status];
          const meta = STATUS_META[status];
          const width =
            counts.total === 0 ? 0 : Math.max((n / counts.total) * 100, n > 0 ? 2 : 0);
          return (
            <div key={status}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-2">{label}</span>
                <span className="font-medium tabular-nums" style={{ color: meta.color }}>
                  {n} ({pct(n, counts.total)})
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${width}%`, background: meta.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lista de vencimentos no formato do sistema antigo: nome, documento,
// tipo e os dias restantes (ou passados).
function ExpiryList({
  title,
  icon,
  certs,
  ready,
  empty,
  delay,
}: {
  title: string;
  icon: React.ReactNode;
  certs: Certificate[];
  ready: boolean;
  empty: string;
  delay: string;
}) {
  return (
    <section className="vlt-card anim-fade-up" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {icon}
          {title}
          {ready && certs.length > 0 && (
            <span className="text-xs font-normal text-ink-3">({certs.length})</span>
          )}
        </h2>
        <Link
          href="/certificados"
          className="flex items-center gap-1 text-xs font-medium text-brand hover:opacity-80"
        >
          Ver todos <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {!ready ? (
        <div className="px-6 py-14" />
      ) : certs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ShieldCheck className="size-8 text-ok" strokeWidth={1.5} />
          <p className="text-sm text-ink-2">{empty}</p>
        </div>
      ) : (
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {certs.map((cert) => {
            const d = daysLeft(cert);
            const meta = STATUS_META[d < 0 ? "expired" : "expiring"];
            return (
              <li key={cert.id}>
                <Link
                  href={`/certificados?cert=${cert.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-panel-2/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cert.holder}</p>
                    <p className="mt-0.5 font-mono text-[0.7rem] text-ink-3">
                      {cert.document}
                    </p>
                  </div>
                  <span className="vlt-badge shrink-0 bg-panel-2 !text-[0.65rem] text-ink-2">
                    {cert.type}
                  </span>
                  <div className="w-16 shrink-0 text-right">
                    <p
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: meta.color }}
                    >
                      {d}d
                    </p>
                    <p className="text-[0.65rem] text-ink-3">
                      {formatDate(cert.expiresAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
