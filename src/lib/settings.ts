"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";

// Preferências pessoais (por navegador). Janela de vencimento, bloqueio
// e política de inatividade são globais do cofre — ver vaultConfig.ts.
export type Settings = {
  notifyBrowser: boolean; // notificações do navegador ao abrir o cofre
  confirmReveal: boolean;
};

export const SETTINGS_DEFAULTS: Settings = {
  notifyBrowser: false,
  confirmReveal: false,
};

export const settingsStore = createLocalStore<Settings>(
  "vault-settings",
  SETTINGS_DEFAULTS,
  (parsed) => ({ ...SETTINGS_DEFAULTS, ...(parsed as Partial<Settings>) }),
);

export function useSettings(): Settings {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.getServer,
  );
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settingsStore.set({ ...settingsStore.get(), [key]: value });
}
