---
name: verify
description: Como rodar e dirigir o Cofre Digital para observar uma mudança funcionando (Next.js + Postgres em Docker, drive por Playwright).
---

# Verificar o Cofre Digital

Superfície: app web (Next.js 16, App Router). Quase tudo é client component,
então **buscar o HTML não mostra nada** — tem que dirigir um browser.

## Subir

O Postgres vive no compose e costuma já estar de pé:

```bash
docker compose ps                  # db healthy? senão: docker compose up -d db
npm run dev                        # porta 3000
```

**Depois de mexer no `schema.prisma`, reinicie o dev server.** O processo
segura o client Prisma antigo em memória; sem restart as rotas quebram com
`Unknown field ... for include statement` mesmo com o `prisma generate` já
tendo rodado. Sintoma típico: lista vem vazia na tela e o erro só aparece em
`.next/dev/logs/next-development.log` (o `useX` engole a falha e seta `[]`).

Migration: `npx prisma migrate dev --name <nome>` (aplica e gera).

## Dirigir

Playwright não é dependência do projeto — instale no scratchpad:

```bash
cd "$SCRATCHPAD" && npm init -y && npm install playwright --no-save
npx playwright install chromium     # o cache do sistema pode estar em outra build
```

Login (o admin do seed está no `.env` do projeto):

```bash
set -a && . /home/edulanzarin/Dev/cofre-digital/.env && set +a && node drive.mjs
```

```js
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL);
await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);          // redireciona para /
```

### Seletores que funcionam

- Listas em card: `ul.vlt-card > li`; título da linha `p.text-sm.font-medium`.
- Tabelas (certificados/alvarás): `tbody tr`.
- Segmentados: `.vlt-segment button`, ativo = `[data-active="true"]`.
- Chips de filtro: `.vlt-chip`, ativo = `[data-active="true"]`.
- **Modal é portal no `body`** — escopar em `.anim-pop`, senão o
  `input.vlt-input` que você pega é o campo de busca da página atrás.
- Filtros vivem na URL (`?q=`, `?status=`, `?doc=`, `?grupo=`): dá pra
  conferir estado lendo `page.url()` e testar deep-link direto.
- Linhas com edição inline (grupos): ao entrar em edição o nome sai do texto
  e vira `value` de input, então `hasText` para de casar. Pegue o índice
  antes de clicar em Renomear e use `.nth(i)`.

`page.request.get/post` herda o cookie de sessão — útil para semear dados
que a UI demoraria a criar (ex.: um certificado e-CPF).

## Limpar depois

O banco de dev tem dados reais do Eduardo. Apague o que você semeou:

```bash
docker compose exec -T db psql -U vault -d vault -c "delete from ..."
```

`CertificateEvent` tem FK para `Certificate` — apague o evento antes do
certificado.

**Semear é criar linha nova descartável, não mudar linha que já existe.**
Se o teste vincular/alterar uma linha real (ex.: pôr uma empresa do Eduardo
num grupo de teste), a limpeza *não desfaz*: apagar o grupo com
`onDelete: SetNull` zera o `groupId`, mas não devolve o valor anterior — some
a vinculação de verdade. Aconteceu com "2RXD → Teste" em 20/07/2026. Se
precisar mesmo mexer numa linha real, leia o valor antes e restaure-o no fim;
melhor ainda, crie uma empresa/grupo descartável só pro teste. Ver princípio
[[Semear teste cria linha nova, não muta linha real]] no Brain.
