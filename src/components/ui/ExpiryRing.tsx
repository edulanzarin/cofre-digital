"use client";

import {
  certStatus,
  lifePercent,
  STATUS_META,
  type Certificate,
} from "@/lib/certificates";
import { useVaultConfig } from "@/lib/vaultConfig";

// Anel de vida do certificado: quanto do prazo já foi consumido.
export default function ExpiryRing({
  cert,
  size = 40,
}: {
  cert: Pick<Certificate, "issuedAt" | "expiresAt">;
  size?: number;
}) {
  const { alertDays } = useVaultConfig();
  const pct = lifePercent(cert);
  const meta = STATUS_META[certStatus(cert, alertDays)];
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--line)"
        strokeWidth={3.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={meta.color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}
