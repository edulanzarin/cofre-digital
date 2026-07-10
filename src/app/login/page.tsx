"use client";

import { useState } from "react";
import { Vault, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Falha no login.");
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Não foi possível conectar ao servidor.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="anim-fade-up flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-(--brand-glow)">
          <Vault className="size-7" strokeWidth={1.7} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Cofre Digital</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            Certificados e acessos da Navecon
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="vlt-card anim-fade-up w-full max-w-sm space-y-4 p-6"
        style={{ animationDelay: "80ms" }}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">E-mail</span>
          <input
            type="email"
            className="vlt-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Senha</span>
          <input
            type="password"
            className="vlt-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-xs text-bad">{error}</p>}

        <button
          type="submit"
          className="vlt-btn vlt-btn-primary w-full"
          disabled={loading}
        >
          <LogIn className="size-4" />
          {loading ? "Entrando…" : "Entrar no cofre"}
        </button>
      </form>
    </div>
  );
}
