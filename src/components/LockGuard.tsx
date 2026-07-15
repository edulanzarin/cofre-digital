"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, ShieldCheck, Hourglass } from "lucide-react";
import { refreshVaultConfig, unlockVault, useVaultConfig } from "@/lib/vaultConfig";
import { logout, useMe } from "@/lib/useMe";

const POLL_MS = 12_000;

// Cadeado GLOBAL do cofre: um admin bloqueia e trava para todos.
// Também aplica a política de inatividade (sair da conta após X min).
export default function LockGuard() {
  const { locked, autoLock, lockMinutes } = useVaultConfig();
  const { me, admin } = useMe();
  const lastActivity = useRef(0);

  // Mantém o estado do cadeado fresco (bloqueio de um vale pra todos).
  useEffect(() => {
    const timer = setInterval(refreshVaultConfig, POLL_MS);
    const onFocus = () => refreshVaultConfig();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Inatividade: política global — sem uso por X min, sai da conta.
  useEffect(() => {
    if (!autoLock || !me) return;

    const bump = () => {
      lastActivity.current = Date.now();
    };
    bump();
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current >= lockMinutes * 60_000) {
        logout();
      }
    }, 10_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [autoLock, lockMinutes, me]);

  if (!locked) return null;
  return <LockScreen admin={admin} />;
}

function LockScreen({ admin }: { admin: boolean }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await unlockVault(pin);
    if (!ok) {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-(--brand-glow)">
        <Lock className="size-7" strokeWidth={1.8} />
      </div>
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold tracking-tight">Cofre bloqueado</h1>
        <p className="mt-1 text-sm text-ink-3">
          {admin
            ? "O cofre está bloqueado para todos. Digite o PIN para liberar."
            : "Um administrador bloqueou o cofre temporariamente (manutenção ou alteração em massa). Tente novamente em instantes."}
        </p>
      </div>

      {admin ? (
        <form onSubmit={handleSubmit} className="flex w-64 flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            placeholder="PIN"
            className="vlt-input text-center font-mono text-lg tracking-[0.4em]"
          />
          {error && (
            <p className="text-center text-xs text-bad">PIN incorreto. Tente de novo.</p>
          )}
          <button type="submit" className="vlt-btn vlt-btn-primary" disabled={!pin}>
            <ShieldCheck className="size-4" />
            Desbloquear para todos
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-xs text-ink-2">
          <Hourglass className="size-3.5 animate-pulse text-warn" />
          Aguardando um administrador liberar…
        </div>
      )}
    </div>
  );
}
