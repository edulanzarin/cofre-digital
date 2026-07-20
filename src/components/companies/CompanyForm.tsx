"use client";

import { useMemo, useState } from "react";
import { Network } from "lucide-react";
import type { Company } from "@/lib/companies";
import type { CompanyGroup } from "@/lib/companyGroups";
import type { CompanyInput } from "@/lib/useCompanies";
import { formatDocument } from "@/lib/certificates";
import Combobox from "@/components/ui/Combobox";

export default function CompanyForm({
  initial,
  groups,
  onSubmit,
  onCancel,
}: {
  initial?: Company;
  groups?: CompanyGroup[];
  onSubmit: (data: CompanyInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [razaoSocial, setRazaoSocial] = useState(initial?.razaoSocial ?? "");
  const [cnpj, setCnpj] = useState(initial ? formatDocument(initial.cnpj) : "");
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [error, setError] = useState("");

  const digits = cnpj.replace(/\D/g, "");

  const groupOptions = useMemo(
    () => [
      { value: "", label: "Sem grupo" },
      ...(groups ?? []).map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (digits.length !== 14) {
      setError("CNPJ precisa ter 14 dígitos.");
      return;
    }
    try {
      await onSubmit({
        razaoSocial: razaoSocial.trim(),
        cnpj: digits,
        groupId: groupId || null,
      });
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

      {/* Grupo econômico — só aparece depois que existe algum grupo criado. */}
      {groups && groups.length > 0 && (
        <div className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">
            Grupo (opcional)
          </span>
          <Combobox
            options={groupOptions}
            value={groupId}
            onChange={setGroupId}
            searchPlaceholder="Buscar grupo…"
            icon={<Network className="size-4 shrink-0 text-ink-3" />}
          />
        </div>
      )}

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
