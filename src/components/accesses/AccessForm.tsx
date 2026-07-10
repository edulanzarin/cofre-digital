"use client";

import { useState } from "react";
import Link from "next/link";
import { FileKey2 } from "lucide-react";
import { LOGIN_TYPES, type Access, type LoginType } from "@/lib/accesses";
import { useCertificates } from "@/lib/useCertificates";
import MarkdownEditor from "@/components/ui/MarkdownEditor";

const LOGIN_PLACEHOLDERS: Record<LoginType, string> = {
  CNPJ: "00.000.000/0000-00",
  CPF: "000.000.000-00",
  "E-mail": "email@empresa.com.br",
  Usuário: "nome de usuário",
  "Certificado digital": "",
  Outro: "identificação do login",
};

export default function AccessForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Access;
  onSubmit: (data: Omit<Access, "id">) => void;
  onCancel: () => void;
}) {
  const { certs, ready } = useCertificates();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    loginType: initial?.loginType ?? ("CNPJ" as LoginType),
    loginValue: initial?.loginValue ?? "",
    password: initial?.password ?? "",
    certificateId: initial?.certificateId ?? "",
    notes: initial?.notes ?? "",
    tutorial: initial?.tutorial ?? "",
  });

  const byCertificate = form.loginType === "Certificado digital";

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      url: form.url.trim(),
      loginType: form.loginType,
      loginValue: byCertificate ? "" : form.loginValue.trim(),
      password: byCertificate ? "" : form.password,
      certificateId: byCertificate ? form.certificateId : null,
      notes: form.notes.trim() || undefined,
      tutorial: form.tutorial.trim() ? form.tutorial : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <Field label="Nome do acesso" className="col-span-3">
          <input
            className="vlt-input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Prefeitura de Blumenau"
            required
            autoFocus
          />
        </Field>
        <Field label="Entrar com" className="col-span-2">
          <select
            className="vlt-input"
            value={form.loginType}
            onChange={(e) => set("loginType", e.target.value as LoginType)}
          >
            {LOGIN_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Link do site">
        <input
          type="url"
          className="vlt-input font-mono !text-[0.8rem]"
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://nfse.blumenau.sc.gov.br"
          required
        />
      </Field>

      {byCertificate ? (
        // Login por certificado: puxa direto dos certificados do cofre.
        <Field label="Certificado do cofre">
          {ready && certs.length === 0 ? (
            <p className="rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-xs text-ink-2">
              Nenhum certificado no cofre ainda.{" "}
              <Link href="/certificados" className="text-brand underline">
                Cadastre o certificado primeiro
              </Link>{" "}
              e volte aqui para vincular.
            </p>
          ) : (
            <>
              <div className="relative">
                <FileKey2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
                <select
                  className="vlt-input !pl-9"
                  value={form.certificateId}
                  onChange={(e) => set("certificateId", e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {ready ? "Escolha o certificado…" : "Carregando certificados…"}
                  </option>
                  {certs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.holder} — {c.type}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-[0.68rem] text-ink-3">
                A senha deste acesso passa a ser a do certificado vinculado.
              </p>
            </>
          )}
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label={form.loginType === "Outro" ? "Login" : form.loginType}>
            <input
              className="vlt-input"
              value={form.loginValue}
              onChange={(e) => set("loginValue", e.target.value)}
              placeholder={LOGIN_PLACEHOLDERS[form.loginType]}
              required
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              className="vlt-input font-mono"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </Field>
        </div>
      )}

      <Field label="Observações">
        <input
          className="vlt-input"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Ex.: usado para emitir NFS-e das empresas de Blumenau"
        />
      </Field>

      <Field label="Manual de acesso (opcional)">
        <MarkdownEditor
          value={form.tutorial}
          onChange={(v) => set("tutorial", v)}
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
