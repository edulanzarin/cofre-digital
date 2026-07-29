"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileKey2,
  UploadCloud,
  Sparkles,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  CreditCard,
  Building2,
  Network,
} from "lucide-react";
import type { Certificate, CertMedia, CertType } from "@/lib/certificates";
import {
  documentKind,
  isValidDocument,
  typeMatchesDocument,
} from "@/lib/certificates";
import type { Company } from "@/lib/companies";
import type { CompanyGroup } from "@/lib/companyGroups";
import { bufferToBase64, parsePfx, PfxError } from "@/lib/pfx";
import Combobox from "@/components/ui/Combobox";
import PasswordInput from "@/components/ui/PasswordInput";

// O certificado carrega, além dos seus campos, o grupo a aplicar na empresa
// dona do cofre — resolve tudo numa tela só quando o cert cria a empresa.
export type CertSubmit = Omit<Certificate, "id"> & { groupId?: string | null };

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

// Cadastro novo por arquivo é guiado: 1) arquivo → senha (modalzinho) → leitura
// automática → 2) conferir (campos só aparecem depois da leitura, para ninguém
// digitar tudo à mão sem querer). Edição e cartão/token mostram os campos
// direto; na edição, escolher outro arquivo reabre o modal de senha e relê.
export default function CertForm({
  initial,
  fixedCompanyId,
  fixedCompanyName,
  groups,
  onCreateGroup,
  onSubmit,
  onCancel,
}: {
  initial?: Certificate;
  fixedCompanyId?: string; // criando de dentro do cofre de uma empresa
  fixedCompanyName?: string; // razaoSocial da empresa, para nomear o .pfx
  groups?: CompanyGroup[]; // grupos econômicos, para atribuir à empresa
  onCreateGroup?: (name: string) => Promise<string>; // cria grupo na hora
  onSubmit: (data: CertSubmit) => void;
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
  // Grupo do certificado. Com empresa dona, aplica-se a ela; sem empresa (e-CPF
  // avulso), fica no próprio cert. Começa no grupo efetivo atual e, ao salvar,
  // só atribui — vazio = não mexe.
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");

  // Ao trocar a empresa, atualiza o fileName do .pfx já carregado.
  function handleCompanyChange(id: string) {
    setCompanyId(id);
    if (!fileBuffer.current && !fileData) return; // sem arquivo, nada a renomear
    const company = id && companies ? companies.find((c) => c.id === id) : null;
    if (company) {
      const safeName = `${company.razaoSocial.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_")}.pfx`;
      setFileName(safeName);
    }
  }
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [fileData, setFileData] = useState(initial?.fileData ?? "");
  const fileBuffer = useRef<ArrayBuffer | null>(null);
  // Só quando o usuário escolhe um arquivo NOVO os bytes voltam pro servidor.
  // Editar só os dados não reenvia (nem faz regravar na rede) o .pfx que já
  // está guardado — era isso que fazia toda edição reescrever o arquivo.
  const fileChanged = useRef(false);
  // Arquivo escolhido aguardando a senha no modalzinho de leitura.
  const [pending, setPending] = useState<{
    buffer: ArrayBuffer;
    name: string;
  } | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [parseState, setParseState] = useState<ParseState>({ kind: "idle" });
  // Editando e o .pfx escolhido é de OUTRO documento: aviso de que se está
  // substituindo o certificado por um diferente (e não só renovando o mesmo).
  const [replaceWarning, setReplaceWarning] = useState<string | null>(null);
  // Só o cadastro novo por arquivo esconde os campos até a leitura.
  const guided = media === "file" && !initial;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showFields = !guided || detailsOpen;
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

  function switchMedia(next: CertMedia) {
    setMedia(next);
    const types = next === "file" ? FILE_TYPES : CARD_TYPES;
    if (!types.includes(form.type)) set("type", types[0]);
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    // Nome legível pela empresa selecionada; senão o nome do próprio arquivo.
    const resolvedName = fixedCompanyName
      ? fixedCompanyName
      : companyId && companies
        ? companies.find((c) => c.id === companyId)?.razaoSocial
        : null;
    const safeName = resolvedName
      ? `${resolvedName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_")}.pfx`
      : file.name;
    // Escolher o arquivo sempre abre o modal de senha e lê os dados na hora —
    // assim a senha bate com o arquivo (ao trocar por um renovado, ela muda).
    setPwError(null);
    setPending({ buffer, name: safeName });
  }

  // Confirma a senha do modalzinho: lê o .pfx, preenche os campos e só então
  // "adota" o arquivo (bytes + nome). Senha errada mantém o modal aberto.
  function confirmPassword(password: string) {
    if (!pending) return;
    if (!password) {
      setPwError("Digite a senha do certificado.");
      return;
    }
    try {
      const data = parsePfx(pending.buffer, password);
      fileBuffer.current = pending.buffer;
      fileChanged.current = true;
      setFileData(bufferToBase64(pending.buffer));
      setFileName(pending.name);
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
      // Editando: se o documento do arquivo é diferente do certificado atual,
      // não é renovação — é troca por outro certificado. Avisa em vez de deixar
      // a identidade mudar em silêncio (a proteção do servidor ainda barra um
      // e-CNPJ preso numa empresa incompatível).
      if (initial && data.document) {
        const wasDigits = initial.document.replace(/\D/g, "");
        const nowDigits = data.document.replace(/\D/g, "");
        setReplaceWarning(
          wasDigits && nowDigits && wasDigits !== nowDigits
            ? `Este arquivo é de outro documento (${data.document}). Você está SUBSTITUINDO o certificado por um diferente, não renovando o mesmo. Confira antes de salvar.`
            : null,
        );
      }
      setDetailsOpen(true);
      setParseState({ kind: "ok" });
      setPending(null);
      setPwError(null);
    } catch (err) {
      setPwError(
        err instanceof PfxError
          ? err.message
          : "Falha inesperada ao ler o certificado.",
      );
    }
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
      fileData:
        media === "file" && fileChanged.current ? fileData || undefined : undefined,
      notes: form.notes.trim() || undefined,
      companyId: companyId || undefined,
      groupId: groupId || undefined,
    });
  }

  const groupOptions = (groups ?? []).map((g) => ({ value: g.id, label: g.name }));

  const types = media === "file" ? FILE_TYPES : CARD_TYPES;
  // fileData acompanha o buffer (setados juntos ao ler o arquivo), então basta
  // ele para saber se há arquivo — sem ler o ref durante o render.
  const hasFile = Boolean(fileData);
  const isCnpjType = form.type.startsWith("e-CNPJ") || form.type === "NF-e";
  // Dicas em tempo real: só acusam quando o documento já tem tamanho de CPF/CNPJ
  // (não fica vermelho enquanto a pessoa digita), e a de tipo só quando o
  // documento em si é válido — assim cada aviso aponta uma coisa só.
  const docComplete = documentKind(form.document) !== null;
  const docInvalid = docComplete && !isValidDocument(form.document);
  const typeDocMismatch =
    docComplete && !docInvalid && !typeMatchesDocument(form.type, form.document);

  const dropzone = (
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
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 text-center transition-colors ${
        guided ? "py-6" : "py-4"
      } ${
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
          Arraste o <span className="font-mono">.pfx</span> aqui ou clique para
          escolher
        </p>
      )}
      {!guided && fileName && (
        <p className="text-[0.65rem] text-ink-3">
          Clique ou arraste outro arquivo para substituir
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
  );

  const parseBanners = (
    <>
      {parseState.kind === "ok" && (
        <p className="flex items-center gap-1.5 rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
          <CircleCheck className="size-3.5 shrink-0" />
          Dados extraídos do certificado. Confira e salve.
        </p>
      )}
      {parseState.kind === "error" && (
        <p className="flex items-center gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
          <CircleAlert className="size-3.5 shrink-0" />
          {parseState.message}
        </p>
      )}
      {replaceWarning && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{replaceWarning}</span>
        </p>
      )}
    </>
  );

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

      {/* Fluxo guiado — só cadastro novo por arquivo */}
      {guided && (
        <>
          <div>
            <StepLabel n={1} done={hasFile}>
              Envie o arquivo do certificado
            </StepLabel>
            {dropzone}
          </div>

          {parseBanners}

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

      {showFields && (
        <div className={`space-y-4 ${guided ? "border-t border-line pt-4" : ""}`}>
          {guided && (
            <StepLabel n={2} done={false}>
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
                className={`vlt-input ${docInvalid ? "!border-bad" : ""}`}
                value={form.document}
                onChange={(e) => set("document", e.target.value)}
                placeholder="00.000.000/0000-00"
                required
              />
              {docInvalid && (
                <p className="mt-1 text-[0.7rem] text-bad">
                  Esse CNPJ/CPF não parece válido. Confira os números.
                </p>
              )}
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
              {typeDocMismatch && (
                <p className="mt-1 text-[0.7rem] text-warn">
                  {isCnpjType
                    ? "Este tipo é de CNPJ, mas o documento é um CPF."
                    : "Este tipo é de CPF, mas o documento é um CNPJ."}
                </p>
              )}
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

          {/* Senha do certificado — vem lida do arquivo ou digitada à mão */}
          <Field label="Senha do certificado">
            <PasswordInput
              className="font-mono"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </Field>

          {/* Edição por arquivo: escolher outro .pfx reabre o modal de senha e
              relê os dados automaticamente. */}
          {!guided && media === "file" && (
            <div>
              <p className="mb-1.5 block text-xs font-medium text-ink-2">
                Arquivo (.pfx)
              </p>
              {dropzone}
              <div className="mt-2 space-y-2">{parseBanners}</div>
            </div>
          )}

          {/* Empresa dona do cofre */}
          {!fixedCompanyId && (
            <Field label="Empresa (opcional)">
              <div className="relative">
                <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
                <select
                  className="vlt-input pl-9"
                  value={companyId}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                >
                  <option value="">
                    {isCnpjType
                      ? "Automático pelo CNPJ"
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

          {/* Grupo econômico — com empresa dona, é atribuído a ela; sem empresa
              (e-CPF avulso), fica no próprio certificado. Some quando o cert é
              cadastrado de dentro de uma empresa (lá o grupo se define na
              empresa). Vazio = mantém o grupo atual. */}
          {!fixedCompanyId && (groups?.length || onCreateGroup) && (
            <Field label="Grupo (opcional)">
              <Combobox
                options={groupOptions}
                value={groupId}
                onChange={setGroupId}
                placeholder="Sem alterar o grupo"
                searchPlaceholder="Buscar ou criar grupo…"
                onCreate={onCreateGroup}
                createLabel="Criar grupo"
                icon={<Network className="size-4 shrink-0 text-ink-3" />}
              />
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
          disabled={!showFields}
        >
          {initial ? "Salvar alterações" : "Guardar no cofre"}
        </button>
      </div>

      {pending && (
        <PfxPasswordPrompt
          fileName={pending.name}
          error={pwError}
          onConfirm={confirmPassword}
          onCancel={() => {
            setPending(null);
            setPwError(null);
          }}
        />
      )}
    </form>
  );
}

// Modalzinho que pede a senha assim que um .pfx é escolhido e dispara a leitura
// dos dados. Fica acima do formulário (portal) e o Esc fecha só ele.
function PfxPasswordPrompt({
  fileName,
  error,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  error: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Captura para o Esc fechar só este modal, não o formulário inteiro.
        e.stopImmediatePropagation();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return createPortal(
    <div
      className="anim-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="vlt-card anim-pop w-full max-w-sm shadow-(--shadow-float)">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-semibold tracking-tight">
            Senha do certificado
          </h3>
          <p className="mt-0.5 truncate font-mono text-[0.7rem] text-ink-3">
            {fileName}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-ink-2">
            Digite a senha para ler os dados do certificado.
          </p>
          <PasswordInput
            ref={inputRef}
            className="font-mono"
            placeholder="Senha do certificado"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm(password);
              }
            }}
          />
          {error && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
              <CircleAlert className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onCancel} className="vlt-btn vlt-btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(password)}
            disabled={!password}
            className="vlt-btn vlt-btn-primary"
          >
            <Sparkles className="size-4" />
            Ler dados
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
