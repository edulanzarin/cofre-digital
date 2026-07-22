"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ALERT_DAYS } from "./certificates";

// Configuração global do cofre (vem do banco): igual para todos;
// só admins alteram. Inclui o estado do cadeado geral.

export type VaultConfig = {
  alertDays: number;
  autoLock: boolean;
  lockMinutes: number;
  locked: boolean;
  hasPin: boolean;
  storageRoot: string | null; // pasta raiz dos arquivos; null = arquivos no banco
  storageUnlockable: boolean; // há senha na env para poder alterar a pasta
};

const DEFAULT: VaultConfig = {
  alertDays: DEFAULT_ALERT_DAYS,
  autoLock: true,
  lockMinutes: 15,
  locked: false,
  hasPin: false,
  storageRoot: null,
  storageUnlockable: false,
};

let config: VaultConfig = DEFAULT;
let started = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export async function refreshVaultConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    config = (await res.json()) as VaultConfig;
    notify();
  } catch {
    // sem rede: mantém o último estado conhecido
  }
}

function ensureStarted() {
  if (started) return;
  started = true;
  refreshVaultConfig();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  ensureStarted();
  return () => listeners.delete(fn);
}

export function useVaultConfig(): VaultConfig {
  return useSyncExternalStore(subscribe, () => config, () => DEFAULT);
}

async function call(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Falha na operação.");
  }
}

async function put(path: string, body: unknown) {
  await call(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await refreshVaultConfig();
}

// --- ações de admin ---

export async function updateVaultPolicy(patch: {
  alertDays?: number;
  autoLock?: boolean;
  lockMinutes?: number;
}) {
  await put("/api/config", patch);
}

export async function setVaultPin(pin: string) {
  await put("/api/config/pin", { pin });
}

// Definir/alterar a pasta raiz dos arquivos — exige a senha (env do servidor).
export async function setStorageRoot(path: string, password: string) {
  await put("/api/config/storage", { path, password });
}

// Move para a pasta os arquivos que ainda estão no banco. Devolve a contagem.
export async function migrateStorageFiles(): Promise<{
  certificados: number;
  alvaras: number;
  prints: number;
}> {
  const res = await fetch("/api/config/storage/migrate", { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Falha ao migrar os arquivos.");
  }
  return res.json();
}

export async function removeVaultPin() {
  await call("/api/config/pin", { method: "DELETE" });
  await refreshVaultConfig();
}

export async function lockVault() {
  await call("/api/config/lock", { method: "POST" });
  await refreshVaultConfig();
}

export async function unlockVault(pin: string): Promise<boolean> {
  try {
    await call("/api/config/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    await refreshVaultConfig();
    return true;
  } catch {
    return false;
  }
}
