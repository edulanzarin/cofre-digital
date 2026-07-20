"use client";

import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; message: string };

// Erro fica mais tempo na tela: o usuário precisa ler o motivo.
const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4500,
  error: 7000,
};

// Além disso a pilha é limitada — uma rajada de falhas não cobre a tela.
const MAX = 4;

const listeners = new Set<() => void>();
let toasts: Toast[] = [];
let seq = 0;

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dismissToast(id: number) {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function push(kind: ToastKind, message: string): number {
  const id = ++seq;
  toasts = [...toasts, { id, kind, message }].slice(-MAX);
  emit();
  setTimeout(() => dismissToast(id), DURATION[kind]);
  return id;
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

// Atalho pro padrão que se repete em todo catch: mensagem do Error
// quando existe, senão um texto de fallback.
export function toastError(err: unknown, fallback: string) {
  toast.error(err instanceof Error && err.message ? err.message : fallback);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
}
