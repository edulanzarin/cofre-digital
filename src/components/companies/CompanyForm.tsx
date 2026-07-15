"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import type { CompanyInput } from "@/lib/useCompanies";
import { formatDocument } from "@/lib/certificates";

export default function CompanyForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Company;
  onSubmit: (data: CompanyInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [razaoSocial, setRazaoSocial] = useState(initial?.razaoSocial ?? "");
  const [cnpj, setCnpj] = useState(initial ? formatDocument(initial.cnpj) : "");
  const [error, setError] = useState("");

  const digits = cnpj.replace(/\D/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (digits.length !== 14) {
      setError("CNPJ precisa ter 14 dígitos.");
      return;
    }
    try {
      await onSubmit({ razaoSocial: razaoSocial.trim(), cnpj: digits });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">
          Razão social
        </span>
        <input
          className="vlt-input"
          value={razaoSocial}
          onChange={(e) => setRazaoSocial(e.target.value)}
          placeholder="EMPRESA EXEMPLO LTDA"
          required
          autoFocus
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">CNPJ</span>
        <input
          className="vlt-input font-mono"
          value={cnpj}
          onChange={(e) => setCnpj(formatDocument(e.target.value))}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          required
        />
      </label>

      {error && <p className="text-xs text-bad">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="vlt-btn vlt-btn-primary">
          {initial ? "Salvar alterações" : "Cadastrar empresa"}
        </button>
      </div>
    </form>
  );
}
