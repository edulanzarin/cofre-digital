"use client";

import { certStatus, type Certificate } from "./certificates";
import { alvaraStatus, type Alvara } from "./alvaras";

// "2 vencidos e 1 vencendo" — ou null se está tudo em dia.
function attention(expired: number, expiring: number): string | null {
  if (expired + expiring === 0) return null;
  const parts: string[] = [];
  if (expired > 0) parts.push(`${expired} vencido${expired > 1 ? "s" : ""}`);
  if (expiring > 0) parts.push(`${expiring} vencendo`);
  return parts.join(" e ");
}

// Notificação do navegador ao abrir o cofre com itens em risco.
// Dispara no máximo uma vez por dia.
export function maybeNotifyExpiring(
  certs: Certificate[],
  alvaras: Alvara[],
  alertDays: number,
) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const today = new Date().toDateString();
  try {
    if (localStorage.getItem("vault-notified-at") === today) return;
  } catch {
    return;
  }

  let certExpiring = 0;
  let certExpired = 0;
  for (const c of certs) {
    const s = certStatus(c, alertDays);
    if (s === "expiring") certExpiring++;
    if (s === "expired") certExpired++;
  }
  let alvaraExpiring = 0;
  let alvaraExpired = 0;
  for (const a of alvaras) {
    const s = alvaraStatus(a, alertDays);
    if (s === "expiring") alvaraExpiring++;
    if (s === "expired") alvaraExpired++;
  }

  const lines: string[] = [];
  const certLine = attention(certExpired, certExpiring);
  if (certLine) lines.push(`Certificados: ${certLine}.`);
  const alvaraLine = attention(alvaraExpired, alvaraExpiring);
  if (alvaraLine) lines.push(`Alvarás: ${alvaraLine}.`);
  if (lines.length === 0) return;

  new Notification("Cofre Digital — Navecon", {
    body: lines.join(" "),
  });
  try {
    localStorage.setItem("vault-notified-at", today);
  } catch {
    // sem storage, sem controle de frequência — tudo bem
  }
}
