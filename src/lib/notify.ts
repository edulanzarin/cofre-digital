"use client";

import { certStatus, type Certificate } from "./certificates";

// Notificação do navegador ao abrir o cofre com certificados em risco.
// Dispara no máximo uma vez por dia.
export function maybeNotifyExpiring(certs: Certificate[], alertDays: number) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const today = new Date().toDateString();
  try {
    if (localStorage.getItem("vault-notified-at") === today) return;
  } catch {
    return;
  }

  let expiring = 0;
  let expired = 0;
  for (const c of certs) {
    const s = certStatus(c, alertDays);
    if (s === "expiring") expiring++;
    if (s === "expired") expired++;
  }
  if (expiring + expired === 0) return;

  const parts: string[] = [];
  if (expired > 0) parts.push(`${expired} vencido${expired > 1 ? "s" : ""}`);
  if (expiring > 0) parts.push(`${expiring} vencendo`);

  new Notification("Cofre Digital — Navecon", {
    body: `Certificados precisando de atenção: ${parts.join(" e ")}.`,
  });
  try {
    localStorage.setItem("vault-notified-at", today);
  } catch {
    // sem storage, sem controle de frequência — tudo bem
  }
}
