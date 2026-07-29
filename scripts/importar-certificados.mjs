#!/usr/bin/env node
// Importador em massa de certificados do sistema antigo para o Cofre Digital.
//
// Lê uma PASTA LOCAL de arquivos .pfx/.p12, casa a senha de cada um pelo NOME do
// arquivo (mapa exportado do sistema antigo), lê o próprio certificado (titular,
// documento, AC, emissão e vencimento saem do arquivo) e cria no cofre pela API
// — criando a empresa pelo CNPJ e anexando o grupo. Passa pela MESMA validação
// do app (dígito verificador do CNPJ/CPF, tipo x documento, datas).
//
// Idempotente: reexecutar não duplica (a API recusa documento+tipo+vencimento já
// existente, e a criação de grupo/empresa é por chave única).
//
// Uso:
//   node scripts/importar-certificados.mjs --pfx /caminho/para/os/pfx \
//     [--map ~/cofre-migracao] [--base http://localhost:4004] \
//     [--email admin@... --password ...] [--dry] [--limit N] [--concurrency 4]
//
// --dry   : não grava nada — só lê, casa a senha, valida e diz o que faria.
// --limit : processa só os N primeiros arquivos (teste pequeno).

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import forge from "node-forge";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.resolve(HERE, "..");

// ---------- argumentos ----------
function parseArgs(argv) {
  const a = { map: `${process.env.HOME}/cofre-migracao`, concurrency: 4 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--pfx") a.pfx = next();
    else if (k === "--map") a.map = next();
    else if (k === "--base") a.base = next();
    else if (k === "--email") a.email = next();
    else if (k === "--password") a.password = next();
    else if (k === "--cookie") a.cookie = next();
    else if (k === "--limit") a.limit = Number(next());
    else if (k === "--concurrency") a.concurrency = Math.max(1, Number(next()));
    else if (k === "--dry") a.dry = true;
  }
  return a;
}

// Lê um valor do .env do projeto (fallback quando não veio por argumento).
async function envValue(key) {
  try {
    const raw = await readFile(`${PROJ}/.env`, "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    // Tira aspas em volta do valor (o .env guarda a senha como "...").
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

// Formata dígitos como CNPJ (14) ou CPF (11) — igual ao formatDocument do app,
// para o documento entrar no cofre no mesmo formato de quem cadastra pela tela.
function formatDocument(digits) {
  const d = String(digits).replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d;
}

// ---------- leitura do .pfx (espelha o parsePfx do app) ----------
function parsePfx(buffer, password) {
  const asn1 = forge.asn1.fromDer(buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const certs = bags.map((b) => b.cert).filter(Boolean);
  if (!certs.length) throw new Error("arquivo sem certificado");
  const dn = (name) => name.attributes.map((x) => `${x.shortName}=${String(x.value)}`).join(",");
  // A folha é a de vencimento mais recente entre as que ninguém assina (renovado > antigo).
  const leaves = certs.filter((c) => certs.every((o) => o === c || dn(o.issuer) !== dn(c.subject)));
  const leaf = (leaves.length ? leaves : certs).reduce((b, c) =>
    c.validity.notAfter > b.validity.notAfter ? c : b,
  );
  const cn = String(leaf.subject.getField("CN")?.value ?? "");
  const [rawName, rawDoc] = cn.includes(":") ? cn.split(":") : [cn, ""];
  const doc = rawDoc.replace(/\D/g, "");
  const type = doc.length === 11 ? "e-CPF A1" : "e-CNPJ A1";
  const issuer = String(leaf.issuer.getField("CN")?.value ?? leaf.issuer.getField("O")?.value ?? "");
  return {
    holder: rawName.trim(),
    document: formatDocument(doc), // formatado, como o app salva
    type,
    issuer: issuer.trim(),
    issuedAt: leaf.validity.notBefore.toISOString(),
    expiresAt: leaf.validity.notAfter.toISOString(),
  };
}

// ---------- cliente HTTP do cofre ----------
function makeClient(base, initialCookie = "") {
  // Aceita o cookie completo ("vault_session=...") ou só o valor.
  let cookie =
    initialCookie && !initialCookie.includes("=")
      ? `vault_session=${initialCookie}`
      : initialCookie;
  async function req(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* resposta sem corpo */
    }
    return { status: res.status, json, res };
  }
  return {
    async login(email, password) {
      const { status, json, res } = await req("POST", "/api/auth/login", { email, password });
      if (status !== 200) throw new Error(`login falhou (${status}): ${json?.error ?? ""}`);
      const set = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
      const vault = set.find((c) => c && c.startsWith("vault_session="));
      if (!vault) throw new Error("login não devolveu o cookie de sessão");
      cookie = vault.split(";")[0];
    },
    req,
  };
}

// Varre a pasta recursivamente (os .pfx podem estar em subpastas E-cnpj/E-cpf).
// Devolve { full, name } — full para ler, name (basename) para casar no mapa.
async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(pfx|p12)$/i.test(ent.name)) out.push({ full, name: ent.name });
  }
  return out;
}

// ---------- pool de concorrência simples ----------
async function pool(items, size, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

// ---------- principal ----------
const args = parseArgs(process.argv);
if (!args.pfx) {
  console.error("Faltou --pfx <pasta com os .pfx/.p12>. Veja o cabeçalho do script.");
  process.exit(1);
}
const base = args.base || `http://localhost:${(await envValue("APP_PORT")) || (await envValue("PORT")) || 4004}`;
const email = args.email || (await envValue("SEED_ADMIN_EMAIL"));
const password = args.password || (await envValue("SEED_ADMIN_PASSWORD"));

// mapa nome-do-arquivo -> { senha, grupo, ... }
const detalhe = JSON.parse(await readFile(`${args.map}/dados-por-arquivo.json`, "utf8"));
// índice auxiliar por CNPJ (fallback quando o nome do arquivo não bate exatamente)
const porCnpj = {};
for (const [arq, d] of Object.entries(detalhe)) if (d.cnpjCpf) porCnpj[d.cnpjCpf] = { arq, ...d };

let files = (await walk(args.pfx)).sort((a, b) => a.name.localeCompare(b.name));
if (args.limit) files = files.slice(0, args.limit);

console.log(`Pasta:   ${args.pfx}`);
console.log(`Mapa:    ${args.map}/dados-por-arquivo.json (${Object.keys(detalhe).length} entradas)`);
console.log(`Cofre:   ${base}`);
console.log(`Arquivos .pfx/.p12: ${files.length}${args.limit ? ` (limitado a ${args.limit})` : ""}`);
console.log(args.dry ? "MODO DRY-RUN (não grava nada)\n" : "MODO REAL (vai gravar no cofre)\n");

const client = makeClient(base, args.cookie || "");
const groupIdByName = new Map();

if (!args.dry) {
  if (!args.cookie) {
    if (!email || !password) {
      console.error("Faltou --email/--password (ou SEED_ADMIN_* no .env), ou --cookie, para autenticar.");
      process.exit(1);
    }
    await client.login(email, password);
  }
  // Carrega grupos existentes e cria os que faltam (nomes vindos do sistema antigo).
  const { json: existentes } = await client.req("GET", "/api/company-groups");
  for (const g of existentes ?? []) groupIdByName.set(g.name, g.id);
  const nomesNecessarios = new Set(
    files.map((f) => detalhe[f.name]?.grupo?.trim()).filter((n) => n && !groupIdByName.has(n)),
  );
  for (const nome of nomesNecessarios) {
    const { status, json } = await client.req("POST", "/api/company-groups", { name: nome });
    if (status === 201 && json?.id) groupIdByName.set(nome, json.id);
    else if (status === 409) {
      const { json: novos } = await client.req("GET", "/api/company-groups");
      for (const g of novos ?? []) groupIdByName.set(g.name, g.id);
    }
  }
  console.log(`Grupos prontos: ${groupIdByName.size}\n`);
}

const stats = { criado: 0, duplicado: 0, semSenha: 0, senhaRuim: 0, validacao: 0, erro: 0 };
const relatorio = [];
let done = 0;

await pool(files, args.dry ? 1 : args.concurrency, async (f) => {
  const meta = detalhe[f.name];
  const record = (status, detalheMsg) => {
    stats[status]++;
    relatorio.push({ arquivo: f.name, status, detalhe: detalheMsg ?? "" });
    done++;
    if (done % 25 === 0 || done === files.length) {
      process.stdout.write(`\r  ${done}/${files.length}  (criados ${stats.criado}, dup ${stats.duplicado}, falhas ${stats.semSenha + stats.senhaRuim + stats.validacao + stats.erro})   `);
    }
  };

  // 1) senha pelo nome do arquivo; sem isso não dá nem pra abrir o .pfx
  const senha = meta?.senha;
  if (!senha) return record("semSenha", "nome do arquivo não está no mapa");

  // 2) lê o .pfx com a senha
  let parsed;
  try {
    const bytes = await readFile(f.full);
    parsed = parsePfx(bytes, String(senha));
    parsed._base64 = bytes.toString("base64");
  } catch {
    return record("senhaRuim", "a senha do mapa não abre o arquivo");
  }

  const grupoNome = meta?.grupo?.trim() || "";
  const body = {
    holder: parsed.holder,
    document: parsed.document,
    type: parsed.type,
    media: "file",
    issuer: parsed.issuer || "Migrado do sistema antigo",
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    password: String(senha),
    fileName: f.name,
    fileData: parsed._base64,
    groupId: (grupoNome && groupIdByName.get(grupoNome)) || undefined,
  };

  if (args.dry) {
    return record("criado", `${parsed.holder} · ${parsed.type} · venc ${parsed.expiresAt.slice(0, 10)}${grupoNome ? ` · grupo ${grupoNome}` : ""}`);
  }

  try {
    const { status, json } = await client.req("POST", "/api/certificates", body);
    if (status === 201) return record("criado", parsed.holder);
    if (status === 409) return record("duplicado", json?.error ?? "");
    if (status === 400) return record("validacao", json?.error ?? "");
    return record("erro", `HTTP ${status}: ${json?.error ?? ""}`);
  } catch (e) {
    return record("erro", String(e.message).slice(0, 80));
  }
});

process.stdout.write("\n\n");
console.log("Resumo:");
console.log(`  criados/prontos : ${stats.criado}`);
console.log(`  duplicados      : ${stats.duplicado}`);
console.log(`  sem senha (nome não bate) : ${stats.semSenha}`);
console.log(`  senha não abre o .pfx     : ${stats.senhaRuim}`);
console.log(`  recusados na validação    : ${stats.validacao}`);
console.log(`  outros erros              : ${stats.erro}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outFile = `${args.map}/importacao-relatorio-${args.dry ? "dry-" : ""}${stamp}.json`;
await writeFile(outFile, JSON.stringify({ base, pasta: args.pfx, dry: !!args.dry, stats, relatorio }, null, 2), "utf8");
console.log(`\nRelatório detalhado: ${outFile}`);
