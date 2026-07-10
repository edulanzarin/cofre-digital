# Cofre Digital — Navecon

Cofre da intranet Navecon: **certificados digitais** (e-CNPJ, e-CPF, NF-e) e
**acessos a sites** (prefeituras, portais, sistemas) com manual ilustrado de
como acessar cada um. Login por usuário com **permissão por setor**. Dados em
**Postgres**, tudo em **Docker**.

## Subindo no PC das automações

```bash
docker compose up -d --build
```

Pronto: o cofre fica em **http://\<ip-do-pc\>:4004** para qualquer máquina da
rede (a porta 4004 é publicada em todas as interfaces). As migrações e o
usuário inicial rodam sozinhos no `up` (serviço `migrate`); os dados ficam no
volume `pgdata`.

**Primeiro acesso**: `eduardo.lanzarin@navecon.net.br` com a senha inicial
`trocar@123` — troque na página Equipe após entrar, ou defina a definitiva
antes do primeiro `up` criando um `.env` na raiz:

```env
SEED_ADMIN_PASSWORD=sua-senha-forte
AUTH_SECRET=um-segredo-longo-aleatorio
POSTGRES_PASSWORD=outra-senha-forte
```

(O seed só roda com o banco vazio; nada disso fica no código.)

## Permissões por setor

| Setor | Pode |
| --- | --- |
| **Societário** | Tudo: cadastrar, editar, excluir, revelar senhas, gerenciar a equipe |
| Fiscal, Contábil, DP, Controladoria, Comercial, Administrativo | Visualizar, **copiar senhas** (sem revelar), baixar .pfx e ler os manuais |

A regra é aplicada **na API** (a senha nem chega ao navegador dos setores de
leitura — só o endpoint de cópia a entrega), não apenas escondendo botões.

## Funcionalidades

- **Certificados**: upload de .pfx com leitura automática (titular, CNPJ/CPF,
  tipo, AC e validade extraídos do próprio arquivo), A1 arquivo vs A3
  cartão/token, download do .pfx, anéis de vencimento. Teste com
  `examples/certificado-teste.pfx` (senha `1234`).
- **Acessos**: link do site, tipo de login (CNPJ, CPF, e-mail, usuário…),
  credenciais e **manual de acesso em Markdown** com imagens (upload ou
  Ctrl+V no editor), com prévia ao escrever.
- **Equipe**: o Societário cadastra usuários por setor e redefine senhas.
- **Bloqueio do cofre**: PIN local (hash SHA-256), bloqueio manual e
  automático por inatividade — camada extra além do login.
- **Configurações**: janela de "vencendo" configurável (vale para badges,
  filtros e visão geral), notificações do navegador, confirmação ao revelar.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Postgres 17** + **Prisma 7** (adapter-pg), API REST em route handlers
- **Tailwind CSS 4** com design system próprio (`src/app/globals.css`, prefixo `vlt-`)
- Certificados e arquivos .pfx (base64) no banco; preferências pessoais
  (tema, PIN, janela de alerta) ficam no navegador de cada um.

## Dev local

```bash
cp .env.example .env
docker compose up -d db          # só o Postgres (5433 exposto pelo override)
npx prisma migrate deploy
npx prisma generate
node --env-file=.env prisma/seed.mjs   # usuário inicial
npm run dev
```

## Design

Dark-first (o cofre nasce no modo noturno; claro é opcional), estética
macOS minimalista com superfícies sólidas: sidebar fixa de ponta a ponta,
conteúdo em largura total, drawer lateral opaco para detalhes, modal para
cadastro/edição, switches estilo iOS e anéis de progresso indicando quanto
da vida do certificado já passou.

Tokens e componentes base ficam em `src/app/globals.css`:

- Cores semânticas: `--brand` (esmeralda), `--ok`, `--warn`, `--bad`
- Superfícies: `.vlt-card`, `.vlt-glass`
- Controles: `.vlt-btn-*`, `.vlt-input`, `.vlt-switch`, `.vlt-segment`

## Estrutura

```
prisma/
  schema.prisma            # User (setores), Certificate, Access, TutorialImage
  migrations/              # Aplicadas pelo serviço "migrate" do compose
  seed.mjs                 # Usuário inicial do Societário
src/
  proxy.ts                 # Exige login em tudo (páginas e API)
  app/
    login/                 # Tela de login
    page.tsx               # Visão geral (dashboard)
    certificados/          # Lista, busca, filtros, drawer e modal
    acessos/               # Sites/prefeituras com manual em Markdown
    equipe/                # Gestão de usuários (só Societário)
    configuracoes/         # Alertas, segurança e aparência
    api/
      auth/ · me/          # Login, logout, sessão
      certificates/        # CRUD + /password (cópia) + /file (download)
      accesses/            # CRUD + /password
      images/              # Upload/serve de imagens dos tutoriais
      users/               # CRUD de equipe (só Societário)
  components/
    AppShell.tsx           # Sidebar + cadeado (some no /login)
    LockGuard.tsx          # Tela de bloqueio + auto-lock por PIN
    ui/                    # Modal, Drawer, Switch, MarkdownEditor/View…
    certificates/ accesses/  # Forms e drawers
  lib/
    auth.ts / api-auth.ts  # Sessão JWT (cookie httpOnly) e guardas
    certificate-api.ts / access-api.ts  # DTOs + validação (server)
    pfx.ts                 # Leitura de PKCS#12 no navegador
    lock.ts / settings.ts / theme.ts    # prefs locais por navegador
```
