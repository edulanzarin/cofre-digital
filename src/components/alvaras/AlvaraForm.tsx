"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, FileText, UploadCloud, X } from "lucide-react";
import type { Alvara } from "@/lib/alvaras";
import { ALVARA_SUGGESTIONS } from "@/lib/alvaras";
import type { Company } from "@/lib/companies";
import { bufferToBase64 } from "@/lib/pfx";

const MAX_PDF_MB = 20;

function toDateInput(iso?: string) {
  return iso ? iso.slice(0, 10) : "";
}

// Cadastro/edição de alvará: os dados são digitados manualmente e o PDF
// do documento é anexado. Datas em branco = alvará sem vencimento.
export default function AlvaraForm({
  initial,
  fixedCompanyId,
  onSubmit,
  onCancel,
}: {
  initial?: Alvara;
  fixedCompanyId?: string; // criando de dentro do cofre de uma empresa
  onSubmit: (data: Omit<Alvara, "id">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    number: initial?.number ?? "",
    issuer: initial?.issuer ?? "",
    issuedAt: toDateInput(initial?.issuedAt),
    expiresAt: toDateInput(initial?.expiresAt),
    notes: initial?.notes ?? "",
  });
  const [companyId, setCompanyId] = useState(
    fixedCompanyId ?? initial?.companyId ?? "",
  );
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [fileData, setFileData] = useState(initial?.fileData ?? "");
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Empresas para o vínculo (opcional). Sem permissão de empresas, segue sem.
  useEffect(() => {
    if (fixedCompanyId) return;
    let active = true;
    fetch("/api/companies")
      .then((r) => (r.ok ? (r.json() as Promise<Company[]>) : []))
      .then((data) => {
        if (active) setCompanies(data);
      })
      .catch(() => {
        if (active) setCompanies([]);
      });
    return () => {
      active = false;
    };
  }, [fixedCompanyId]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFile(file: File) {
    setFileError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Envie o alvará em PDF.");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setFileError(`Arquivo muito grande (máx. ${MAX_PDF_MB} MB).`);
      return;
    }
    const buffer = await file.arrayBuffer();
    setFileName(file.name);
    setFileData(bufferToBase64(buffer));
  }

  function clearFile() {
    setFileName("");
    setFileData("");
    setFileError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      number: form.number.trim() || undefined,
      issuer: form.issuer.trim() || undefined,
      issuedAt: form.issuedAt
        ? new Date(form.issuedAt + "T12:00:00").toISOString()
        : undefined,
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt + "T12:00:00").toISOString()
        : undefined,
      fileName: fileName || undefined,
      fileData: fileData || undefined,
      notes: form.notes.trim() || undefined,
      companyId: companyId || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Tipo do alvará">
        <input
          className="vlt-input"
          list="alvara-suggestions"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Alvará de Funcionamento, Sanitário…"
          required
        />
        <datalist id="alvara-suggestions">
          {ALVARA_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Número (opcional)">
          <input
            className="vlt-input"
            value={form.number}
            onChange={(e) => set("number", e.target.value)}
            placeholder="Nº do documento"
          />
        </Field>
        <Field label="Órgão emissor (opcional)">
          <input
            className="vlt-input"
            value={form.issuer}
            onChange={(e) => set("issuer", e.target.value)}
            placeholder="Prefeitura, bombeiros…"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Emitido em (opcional)">
          <input
            type="date"
            className="vlt-input"
            value={form.issuedAt}
            onChange={(e) => set("issuedAt", e.target.value)}
          />
        </Field>
        <Field label="Vence em (opcional)">
          <input
            type="date"
            className="vlt-input"
            value={form.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
          />
        </Field>
      </div>
      <p className="-mt-2 text-[0.68rem] text-ink-3">
        Sem data de vencimento, o alvará fica como permanente — sem alertas.
      </p>

      {/* PDF do alvará */}
      <div>
        <p className="mb-1.5 block text-xs font-medium text-ink-2">
          PDF do alvará {initial?.hasFile || fileData ? "" : "(opcional)"}
        </p>
        {fileName ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
            <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
            <p className="min-w-0 flex-1 truncate font-mono text-[0.78rem]">
              {fileName}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="vlt-btn vlt-btn-ghost !px-2.5 !py-1 text-xs"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={clearFile}
              className="vlt-icon-btn"
              title="Remover arquivo"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
              dragging
                ? "border-brand bg-brand-soft"
                : "border-line-strong hover:border-brand hover:bg-panel-2"
            }`}
          >
            <UploadCloud className="size-6 text-ink-3" strokeWidth={1.5} />
            <p className="text-xs text-ink-2">
              Arraste o <span className="font-mono">.pdf</span> aqui ou clique
              para escolher
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {fileError && <p className="mt-1.5 text-[0.7rem] text-bad">{fileError}</p>}
      </div>

      {/* Empresa dona do cofre */}
      {!fixedCompanyId && (
        <Field label="Empresa (opcional)">
          <div className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <select
              className="vlt-input pl-9"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Sem empresa</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </Field>
      )}

      <Field label="Observações">
        <textarea
          className="vlt-input min-h-20 resize-y"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Condições, restrições, onde é exigido…"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="vlt-btn vlt-btn-primary">
          {initial ? "Salvar alterações" : "Guardar no cofre"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
