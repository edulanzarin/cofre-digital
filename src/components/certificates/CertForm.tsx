"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileKey2,
  UploadCloud,
  Sparkles,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Building2,
} from "lucide-react";
import type { Certificate, CertMedia, CertType } from "@/lib/certificates";
import type { Company } from "@/lib/companies";
import { bufferToBase64, parsePfx, PfxError } from "@/lib/pfx";

const FILE_TYPES: CertType[] = ["e-CNPJ A1", "e-CPF A1", "NF-e"];
const CARD_TYPES: CertType[] = ["e-CNPJ A3", "e-CPF A3"];

type ParseState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

function toDateInput(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}

// Fluxo guiado: 1) arquivo → 2) senha → leitura automática → 3) conferir.
// Os campos só aparecem depois da leitura (ou de "preencher manualmente"),
// para ninguém digitar tudo à mão sem querer.
export default function CertForm({
  initial,
  fixedCompanyId,
  onSubmit,
  onCancel,
}: {
  initial?: Certificate;
  fixedCompanyId?: string; // criando de dentro do cofre de uma empresa
  onSubmit: (data: Omit<Certificate, "id">) => void;
  onCancel: () => void;
}) {
  const [media, setMedia] = useState<CertMedia>(initial?.media ?? "file");
  const [form, setForm] = useState({
    holder: initial?.holder ?? "",
    document: initial?.document ?? "",
    type: initial?.type ?? ("e-CNPJ A1" as CertType),
    issuer: initial?.issuer ?? "",
    issuedAt: initial ? toDateInput(initial.issuedAt) : "",
    expiresAt: initial ? toDateInput(initial.expiresAt) : "",
    password: initial?.password ?? "",
    notes: initial?.notes ?? "",
  });
  const [companyId, setCompanyId] = useState(
    fixedCompanyId ?? initial?.companyId ?? "",
  );
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [fileData, setFileData] = useState(initial?.fileData ?? "");
  const fileBuffer = useRef<ArrayBuffer | null>(null);
  const [parseState, setParseState] = useState<ParseState>({ kind: "idle" });
  // Edição e cartão/token já mostram tudo; cadastro novo por arquivo
  // esconde os campos até a leitura (ou o clique em "preencher manualmente").
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initial) || media === "card");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  function switchMedia(next: CertMedia) {
    setMedia(next);
    const types = next === "file" ? FILE_TYPES : CARD_TYPES;
    if (!types.includes(form.type)) set("type", types[0]);
    if (next === "card") setDetailsOpen(true);
    else if (!initial && parseState.kind !== "ok") setDetailsOpen(false);
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    fileBuffer.current = buffer;
    setFileName(file.name);
    setFileData(bufferToBase64(buffer));
    setParseState({ kind: "idle" });
    if (form.password) {
      // Senha já digitada: lê direto.
      extract(buffer, form.password);
    } else {
      passwordRef.current?.focus();
    }
  }

  function extract(buffer: ArrayBuffer, password: string) {
    if (!password) {
      setParseState({
        kind: "error",
        message: "Digite a senha do certificado para ler os dados.",
      });
      return;
    }
    setParseState({ kind: "reading" });
    try {
      const data = parsePfx(buffer, password);
      setForm((f) => ({
        ...f,
        holder: data.holder || f.holder,
        document: data.document || f.document,
        type: data.type,
        issuer: data.issuer || f.issuer,
        issuedAt: toDateInput(data.issuedAt),
        expiresAt: toDateInput(data.expiresAt),
        password,
      }));
      setParseState({ kind: "ok" });
      setDetailsOpen(true);
    } catch (err) {
      setParseState({
        kind: "error",
        message:
          err instanceof PfxError
            ? err.message
            : "Falha inesperada ao ler o certificado.",
      });
    }
  }

  function tryExtract() {
    const buffer = fileBuffer.current;
    if (buffer) extract(buffer, form.password);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      holder: form.holder.trim(),
      document: form.document.trim(),
      type: form.type,
      media,
      issuer: form.issuer.trim(),
      issuedAt: new Date(form.issuedAt + "T12:00:00").toISOString(),
      expiresAt: new Date(form.expiresAt + "T12:00:00").toISOString(),
      password: form.password,
      fileName: media === "file" ? fileName || undefined : undefined,
      fileData: media === "file" ? fileData || undefined : undefined,
      notes: form.notes.trim() || undefined,
      companyId: companyId || undefined,
    });
  }

  const types = media === "file" ? FILE_TYPES : CARD_TYPES;
  const hasFile = Boolean(fileBuffer.current || fileData);
  const isCnpjType = form.type.startsWith("e-CNPJ") || form.type === "NF-e";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mídia do certificado */}
      <div className="vlt-segment w-full [&>button]:flex-1">
        <button
          type="button"
          data-active={media === "file"}
          onClick={() => switchMedia("file")}
        >
          <FileKey2 className="size-3.5" />
          Arquivo (.pfx)
        </button>
        <button
          type="button"
          data-active={media === "card"}
          onClick={() => switchMedia("card")}
        >
          <CreditCard className="size-3.5" />
          Cartão / Token
        </button>
      </div>

      {media === "file" && (
        <>
          {/* Passo 1 — arquivo */}
          <div>
            <StepLabel n={1} done={hasFile}>
              Envie o arquivo do certificado
            </StepLabel>
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
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
                dragging
                  ? "border-brand bg-brand-soft"
                  : "border-line-strong hover:border-brand hover:bg-panel-2"
              }`}
            >
              <UploadCloud className="size-6 text-ink-3" strokeWidth={1.5} />
              {fileName ? (
                <p className="font-mono text-xs text-ink">{fileName}</p>
              ) : (
                <p className="text-xs text-ink-2">
                  Arraste o <span className="font-mono">.pfx</span> aqui ou clique
                  para escolher
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>

          {/* Passo 2 — senha + leitura automática */}
          <div>
            <StepLabel n={2} done={parseState.kind === "ok"}>
              Digite a senha — os dados são lidos do próprio certificado
            </StepLabel>
            <input
              ref={passwordRef}
              type="password"
              className="vlt-input font-mono"
              placeholder="Senha do certificado"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              onBlur={() => {
                if (hasFile && form.password && parseState.kind !== "ok") tryExtract();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  tryExtract();
                }
              }}
              required
            />
            <button
              type="button"
              className="vlt-btn vlt-btn-primary mt-2 w-full"
              disabled={!hasFile || !form.password || parseState.kind === "reading"}
              onClick={tryExtract}
            >
              <Sparkles className="size-4" />
              {parseState.kind === "reading"
                ? "Lendo o certificado…"
                : "Ler dados do certificado"}
            </button>
          </div>

          {parseState.kind === "ok" && (
            <p className="flex items-center gap-1.5 rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
              <CircleCheck className="size-3.5 shrink-0" />
              Dados extraídos do certificado — confira abaixo e salve.
            </p>
          )}
          {parseState.kind === "error" && (
            <p className="flex items-center gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
              <CircleAlert className="size-3.5 shrink-0" />
              {parseState.message}
            </p>
          )}

          {!detailsOpen && (
            <p className="text-center text-[0.7rem] text-ink-3">
              Sem o arquivo em mãos?{" "}
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="cursor-pointer font-medium text-brand hover:opacity-80"
              >
                Preencher os dados manualmente
              </button>
            </p>
          )}
        </>
      )}

      {detailsOpen && (
        <div className="space-y-4 border-t border-line pt-4">
          {media === "file" && (
            <StepLabel n={3} done={false}>
              Confira os dados
            </StepLabel>
          )}

          <Field label="Titular">
            <input
              className="vlt-input"
              value={form.holder}
              onChange={(e) => set("holder", e.target.value)}
              placeholder="Empresa ou pessoa física"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CNPJ / CPF">
              <input
                className="vlt-input"
                value={form.document}
                onChange={(e) => set("document", e.target.value)}
                placeholder="00.000.000/0000-00"
                required
              />
            </Field>
            <Field label="Tipo">
              <select
                className="vlt-input"
                value={form.type}
                onChange={(e) => set("type", e.target.value as CertType)}
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Autoridade certificadora">
            <input
              className="vlt-input"
              value={form.issuer}
              onChange={(e) => set("issuer", e.target.value)}
              placeholder="Certisign, Serasa, Valid…"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Emitido em">
              <input
                type="date"
                className="vlt-input"
                value={form.issuedAt}
                onChange={(e) => set("issuedAt", e.target.value)}
                required
              />
            </Field>
            <Field label="Vence em">
              <input
                type="date"
                className="vlt-input"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
                required
              />
            </Field>
          </div>

          {media === "card" && (
            <Field label="Senha do certificado">
              <input
                type="password"
                className="vlt-input font-mono"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
            </Field>
          )}

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
                  <option value="">
                    {isCnpjType
                      ? "Automático — vincula pelo CNPJ do certificado"
                      : "Sem empresa"}
                  </option>
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
              placeholder={
                media === "card"
                  ? "Onde fica o cartão/token, quem usa…"
                  : "Onde é usado, sistemas que dependem dele…"
              }
            />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
          Cancelar
        </button>
        <button
          type="submit"
          className="vlt-btn vlt-btn-primary"
          disabled={!detailsOpen}
        >
          {initial ? "Salvar alterações" : "Guardar no cofre"}
        </button>
      </div>
    </form>
  );
}

function StepLabel({
  n,
  done,
  children,
}: {
  n: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-2">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${
          done ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"
        }`}
      >
        {done ? <CircleCheck className="size-3.5" /> : n}
      </span>
      {children}
    </p>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
