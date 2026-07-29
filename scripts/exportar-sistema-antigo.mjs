#!/usr/bin/env node
// Exporta os certificados do SISTEMA ANTIGO (o "Controle de Certificados" em
// Next.js) para arquivos de mapeamento usados na migração. O sistema antigo
// expõe TUDO em GET /api/certificados (inclusive a senha em texto), então a
// coleta é um único request.
//
// Gera em --out (padrão ~/cofre-migracao):
//   certificados-senhas.json  lista completa
//   certificados-senhas.csv   planilha (com grupo)
//   dados-por-arquivo.json    nome do .pfx -> { senha, cnpjCpf, grupo, ... }
//   senha-por-arquivo.json    nome do .pfx -> senha
//   senha-por-cnpj.json       CNPJ/CPF -> senha
//
// ATENÇÃO: os arquivos contêm senhas em texto puro. Guarde num lugar seguro,
// fora de qualquer repositório, e apague depois de concluir a migração.
//
// Uso:
//   node scripts/exportar-sistema-antigo.mjs [--base http://192.168.5.250:3004] [--out ~/cofre-migracao]

import { mkdir, writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const a = { base: "http://192.168.5.250:3004", out: `${process.env.HOME}/cofre-migracao` };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--base") a.base = argv[++i];
    else if (argv[i] === "--out") a.out = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv);
const basename = (p) => String(p || "").split(/[\\/]/).pop() || "";
const digits = (s) => String(s || "").replace(/\D/g, "");

const res = await fetch(`${args.base}/api/certificados`);
if (!res.ok) {
  console.error(`Falha ao ler ${args.base}/api/certificados (HTTP ${res.status}).`);
  process.exit(1);
}
const all = await res.json();
if (!Array.isArray(all)) {
  console.error("Resposta inesperada: /api/certificados não devolveu uma lista.");
  process.exit(1);
}

const rows = all.map((r) => ({
  arquivo: basename(r.path),
  cnpjCpf: digits(r.cnpjCpf),
  senha: r.senha ?? "",
  nome: r.nome ?? "",
  tipo: r.tipoCertificado ?? "",
  vencimento: r.dataVencimento ? String(r.dataVencimento).slice(0, 10) : "",
  grupo: r.grupo ?? "",
  observacao: (r.observacao ?? "").replace(/\s+/g, " ").trim(),
  path: r.path ?? "",
}));

// diagnóstico de casamento
const dupOf = (key) => {
  const m = new Map();
  for (const r of rows) if (r[key]) m.set(r[key], (m.get(r[key]) || 0) + 1);
  return [...m.entries()].filter(([, n]) => n > 1);
};
const tipos = {};
for (const r of rows) tipos[r.tipo] = (tipos[r.tipo] || 0) + 1;
console.log("total:", rows.length, "| tipos:", tipos);
console.log("sem senha:", rows.filter((r) => !String(r.senha).trim()).length);
console.log("sem arquivo:", rows.filter((r) => !r.arquivo).length);
console.log("nomes de arquivo duplicados:", dupOf("arquivo").length);
console.log("CNPJ/CPF duplicados:", dupOf("cnpjCpf").length);
console.log("com grupo:", rows.filter((r) => r.grupo?.trim()).length);

await mkdir(args.out, { recursive: true });
await writeFile(`${args.out}/certificados-senhas.json`, JSON.stringify(rows, null, 2), "utf8");

const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const cols = ["arquivo", "cnpjCpf", "senha", "nome", "tipo", "vencimento", "grupo", "observacao"];
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
await writeFile(`${args.out}/certificados-senhas.csv`, "﻿" + csv, "utf8");

const detalhe = {};
const porArquivo = {};
const porCnpj = {};
for (const r of rows) {
  if (r.arquivo) {
    detalhe[r.arquivo] = {
      senha: r.senha, cnpjCpf: r.cnpjCpf, nome: r.nome,
      tipo: r.tipo, grupo: r.grupo, vencimento: r.vencimento, observacao: r.observacao,
    };
    porArquivo[r.arquivo] = r.senha;
  }
  if (r.cnpjCpf) porCnpj[r.cnpjCpf] = r.senha;
}
await writeFile(`${args.out}/dados-por-arquivo.json`, JSON.stringify(detalhe, null, 2), "utf8");
await writeFile(`${args.out}/senha-por-arquivo.json`, JSON.stringify(porArquivo, null, 2), "utf8");
await writeFile(`${args.out}/senha-por-cnpj.json`, JSON.stringify(porCnpj, null, 2), "utf8");

console.log(`\nGravado em ${args.out} (contém senhas em texto — guarde com cuidado).`);
