"use client";

import { certStatus, daysLeft, STATUS_META, type Certificate } from "@/lib/certificates";
import { useVaultConfig } from "@/lib/vaultConfig";

export default function StatusBadge({
  cert,
}: {
  cert: Pick<Certificate, "expiresAt">;
}) {
  const { alertDays } = useVaultConfig();
  const status = certStatus(cert, alertDays);
  const meta = STATUS_META[status];
  const d = daysLeft(cert);
  const detail =
    status === "expired"
      ? `há ${Math.abs(d)}d`
      : status === "expiring"
        ? `em ${d}d`
        : null;

  return (
    <span
      className="vlt-badge"
      style={{ color: meta.color, background: meta.soft }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.label}
      {detail && <span className="opacity-70">{detail}</span>}
    </span>
  );
}
