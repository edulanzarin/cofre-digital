#!/usr/bin/env node
// Importa os certificados direto da REDE (SMB), sem depender de uma pasta local.
// Para cada registro do sistema antigo que AINDA NÃO está no cofre, lê o .pfx do
// share pelo `path`, casa a senha, lê o certificado e cadastra pela API (empresa
// pelo CNPJ + grupo). Idempotente (pula o que já está no cofre e o que a API
// recusa por duplicado).
//
// Fonte dos arquivos: SMB (credenciais SMB_* do .env.production).
// Fonte senha/grupo/path: ~/cofre-migracao/certificados-senhas.json.
//
// Uso:
//   node scripts/importar-da-rede.mjs --base http://192.168.5.68:4004 \
//     [--map ~/cofre-migracao] [--dry] [--limit N] [--concurrency 6]

import { readFile, writeFile, mkdtemp, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import forge from "node-forge";

const exec = promisify(execFile);
const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const a = { map: `${process.env.HOME}/cofre-migracao`, base: "http://localhost:4004", concurrency: 6 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--base") a.base = argv[++i];
    else if (argv[i] === "--map") a.map = argv[++i];
    else if (argv[i] === "--limit") a.limit = Number(argv[++i]);
    else if (argv[i] === "--concurrency") a.concurrency = Math.max(1, Number(argv[++i]));
    else if (argv[i] === "--dry") a.dry = true;
  }
  return a;
}

async function envVal(file, key) {
  try {
    const raw = await readFile(`${PROJ}/${file}`, "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

// ---- SMB (espelha o run/read do smb.ts) ----
async function smbRead(smb, rel) {
  const remote = rel.replace(/\//g, "\\");
  const args = [`//${smb.host}/${smb.share}`, "-U", smb.user, "-m", "SMB3", "-c", `get "${remote}" "%LOCAL%"`];
  const dir = await mkdtemp(path.join(tmpdir(), "smb-"));
  const local = path.join(dir, "c.bin");
  args[args.length - 1] = `get "${remote}" "${local}"`;
  if (smb.domain) args.push("-W", smb.domain);
  try {
    const { stdout, stderr } = await exec("smbclient", args, { env: { ...process.env, PASSWD: smb.password }, maxBuffer: 64 * 1024 * 1024 });
    if (/NT_STATUS_[A-Z_]+/.test(`${stdout}${stderr}`)) return null;
    return await readFile(local);
  } catch {
    return null;
  } finally {
    await unlink(local).catch(() => {});
  }
}

// Do UNC "\\host\share\resto\arquivo" tira "resto\arquivo" (relativo ao share).
function relFromUnc(unc) {
  const s = String(unc || "");
  if (!s.startsWith("\\\\")) return s.replace(/\\/g, "/");
  return s.replace(/^\\\\/, "").split("\\").slice(2).join("/");
}

function formatDocument(digits) {
  const d = String(digits).replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d;
}

function parsePfx(buffer, password) {
  const asn1 = forge.asn1.fromDer(buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const certs = bags.map((b) => b.cert).filter(Boolean);
  if (!certs.length) throw new Error("sem certificado");
  const dn = (n) => n.attributes.map((x) => `${x.shortName}=${String(x.value)}`).join(",");
  const leaves = certs.filter((c) => certs.every((o) => o === c || dn(o.issuer) !== dn(c.subject)));
  const leaf = (leaves.length ? leaves : certs).reduce((b, c) => (c.validity.notAfter > b.validity.notAfter ? c : b));
  const cn = String(leaf.subject.getField("CN")?.value ?? "");
  const [rawName, rawDoc] = cn.includes(":") ? cn.split(":") : [cn, ""];
  const doc = rawDoc.replace(/\D/g, "");
  return {
    holder: rawName.trim(),
    document: formatDocument(doc),
    type: doc.length === 11 ? "e-CPF A1" : "e-CNPJ A1",
    issuer: String(leaf.issuer.getField("CN")?.value ?? leaf.issuer.getField("O")?.value ?? "").trim(),
    issuedAt: leaf.validity.notBefore.toISOString(),
    expiresAt: leaf.validity.notAfter.toISOString(),
  };
}

function makeClient(base) {
  let cookie = "";
  async function req(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* sem corpo */ }
    return { status: res.status, json, res };
  }
  return {
    async login(email, password) {
      const { status, res } = await req("POST", "/api/auth/login", { email, password });
      if (status !== 200) throw new Error(`login falhou (${status})`);
      const set = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
      cookie = (set.find((c) => c && c.startsWith("vault_session=")) || "").split(";")[0];
      if (!cookie) throw new Error("sem cookie de sessão");
    },
    req,
  };
}

async function pool(items, size, worker) {
  let i = 0;
  async function run() { while (i < items.length) { const idx = i++; await worker(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

// ---- principal ----
const args = parseArgs(process.argv);
const smb = {
  host: await envVal(".env.production", "SMB_HOST"),
  share: await envVal(".env.production", "SMB_SHARE"),
  user: await envVal(".env.production", "SMB_USER"),
  password: await envVal(".env.production", "SMB_PASSWORD"),
  domain: await envVal(".env.production", "SMB_DOMAIN"),
};
const email = await envVal(".env", "SEED_ADMIN_EMAIL");
const password = await envVal(".env", "SEED_ADMIN_PASSWORD");

const all = JSON.parse(await readFile(`${args.map}/certificados-senhas.json`, "utf8"));
const client = makeClient(args.base);
await client.login(email, password);

// pula o que já está no cofre (idempotente)
const { json: existentes } = await client.req("GET", "/api/certificates");
const noCofre = new Set((existentes ?? []).map((c) => String(c.document || "").replace(/\D/g, "")));

let todo = all.filter((o) => o.cnpjCpf && o.senha && o.path && !noCofre.has(o.cnpjCpf));
if (args.limit) todo = todo.slice(0, args.limit);

console.log(`Cofre: ${args.base} | share: //${smb.host}/${smb.share}`);
console.log(`Sistema antigo: ${all.length} | já no cofre: ${noCofre.size} | a importar da rede: ${todo.length}`);
console.log(args.dry ? "MODO DRY-RUN (lê e parseia, não grava)\n" : "MODO REAL\n");

// grupos: cria os que faltam
const groupIdByName = new Map();
if (!args.dry) {
  const { json: grupos } = await client.req("GET", "/api/company-groups");
  for (const g of grupos ?? []) groupIdByName.set(g.name, g.id);
  const nomes = new Set(todo.map((o) => o.grupo?.trim()).filter((n) => n && !groupIdByName.has(n)));
  for (const nome of nomes) {
    const { status, json } = await client.req("POST", "/api/company-groups", { name: nome });
    if (status === 201 && json?.id) groupIdByName.set(nome, json.id);
    else { const { json: novos } = await client.req("GET", "/api/company-groups"); for (const g of novos ?? []) groupIdByName.set(g.name, g.id); }
  }
  console.log(`Grupos prontos: ${groupIdByName.size}\n`);
}

const stats = { criado: 0, duplicado: 0, semArquivo: 0, senhaRuim: 0, validacao: 0, erro: 0 };
const relatorio = [];
let done = 0;
await pool(todo, args.dry ? 2 : args.concurrency, async (o) => {
  const rec = (status, detalhe) => {
    stats[status]++;
    relatorio.push({ cnpj: o.cnpjCpf, nome: o.nome, status, detalhe: detalhe ?? "" });
    if (++done % 25 === 0 || done === todo.length)
      process.stdout.write(`\r  ${done}/${todo.length}  (criados ${stats.criado}, dup ${stats.duplicado}, falhas ${stats.semArquivo + stats.senhaRuim + stats.validacao + stats.erro})    `);
  };
  const bytes = await smbRead(smb, relFromUnc(o.path));
  if (!bytes) return rec("semArquivo", "não achei o .pfx na rede");
  let parsed;
  try { parsed = parsePfx(bytes, String(o.senha)); } catch { return rec("senhaRuim", "senha não abre o arquivo"); }
  const body = {
    holder: parsed.holder, document: parsed.document, type: parsed.type, media: "file",
    issuer: parsed.issuer || "Migrado do sistema antigo", issuedAt: parsed.issuedAt, expiresAt: parsed.expiresAt,
    password: String(o.senha), fileName: o.path.split(/[\\/]/).pop(), fileData: bytes.toString("base64"),
    groupId: (o.grupo?.trim() && groupIdByName.get(o.grupo.trim())) || undefined,
  };
  if (args.dry) return rec("criado", `${parsed.holder} · ${parsed.type} · venc ${parsed.expiresAt.slice(0, 10)}`);
  try {
    const { status, json } = await client.req("POST", "/api/certificates", body);
    if (status === 201) return rec("criado", parsed.holder);
    if (status === 409) return rec("duplicado", json?.error ?? "");
    if (status === 400) return rec("validacao", json?.error ?? "");
    return rec("erro", `HTTP ${status}: ${json?.error ?? ""}`);
  } catch (e) { return rec("erro", String(e.message).slice(0, 80)); }
});

process.stdout.write("\n\nResumo:\n");
console.log(`  criados/prontos : ${stats.criado}`);
console.log(`  duplicados      : ${stats.duplicado}`);
console.log(`  .pfx não achado na rede : ${stats.semArquivo}`);
console.log(`  senha não abre          : ${stats.senhaRuim}`);
console.log(`  recusados na validação  : ${stats.validacao}`);
console.log(`  outros erros            : ${stats.erro}`);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = `${args.map}/importacao-rede-relatorio-${args.dry ? "dry-" : ""}${stamp}.json`;
await writeFile(out, JSON.stringify({ base: args.base, dry: !!args.dry, stats, relatorio }, null, 2), "utf8");
console.log(`\nRelatório: ${out}`);
