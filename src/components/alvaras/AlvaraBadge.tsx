"use client";

import {
  alvaraDaysLeft,
  alvaraStatus,
  ALVARA_STATUS_META,
  type Alvara,
} from "@/lib/alvaras";
import { useVaultConfig } from "@/lib/vaultConfig";

export default function AlvaraBadge({
  alvara,
}: {
  alvara: Pick<Alvara, "expiresAt">;
}) {
  const { alertDays } = useVaultConfig();
  const status = alvaraStatus(alvara, alertDays);
  const meta = ALVARA_STATUS_META[status];
  const d = alvaraDaysLeft(alvara);
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
