# Migração dos certificados do sistema antigo

Traz os certificados do "Controle de Certificados" antigo (Next.js em
`192.168.5.250:3004`) para o Cofre Digital, com senha, empresa (pelo CNPJ) e
grupo.

O sistema antigo guarda só o **caminho** do `.pfx` numa pasta de rede e a
**senha** (em `GET /api/certificados`). O `.pfx` em si é que tem titular, AC,
emissão e vencimento — por isso a importação lê o arquivo. A ponte entre os dois
é o **nome do arquivo** (`NOME - CNPJ.pfx`), que é único (conferido: 0 nomes e 0
CNPJs duplicados nos 1156 registros).

> **As senhas saem em texto puro.** Os arquivos gerados ficam em
> `~/cofre-migracao` (fora do repositório). Guarde com cuidado e apague depois.

## 1. Exportar o mapa do sistema antigo

Enquanto o sistema antigo ainda responde:

```bash
node scripts/exportar-sistema-antigo.mjs --base http://192.168.5.250:3004 --out ~/cofre-migracao
```

Gera em `~/cofre-migracao`: `certificados-senhas.{json,csv}`,
`dados-por-arquivo.json`, `senha-por-arquivo.json`, `senha-por-cnpj.json`.

## 2. Juntar os arquivos .pfx/.p12 numa pasta local

Copie todos os certificados da pasta de rede para uma pasta local, ex.:
`~/cofre-migracao/pfx`. Os nomes têm que ser os mesmos do sistema antigo
(`NOME - CNPJ.pfx`) — é assim que a senha é casada.

## 3. Importar no cofre

Com o cofre novo rodando (ex.: `http://localhost:4004`) e um admin cadastrado:

```bash
# 1) teste pequeno, sem gravar:
node scripts/importar-certificados.mjs --pfx ~/cofre-migracao/pfx --dry --limit 20

# 2) teste pequeno gravando de verdade:
node scripts/importar-certificados.mjs --pfx ~/cofre-migracao/pfx --limit 20

# 3) tudo:
node scripts/importar-certificados.mjs --pfx ~/cofre-migracao/pfx
```

Opções: `--map` (pasta do mapa, padrão `~/cofre-migracao`), `--base` (URL do
cofre), `--email`/`--password` (admin; senão usa `SEED_ADMIN_*` do `.env`),
`--concurrency N` (padrão 4).

O importador, para cada `.pfx`: casa a senha pelo nome do arquivo, lê o
certificado, cria a empresa pelo CNPJ, cria/anexa o grupo e cadastra pela API
(passando pela validação normal). É **idempotente**: rodar de novo não duplica
(a API recusa documento+tipo+vencimento repetido). No fim grava um
`importacao-relatorio-*.json` com o que subiu e o que falhou (senha
desatualizada que não abre o `.pfx`, nome fora do mapa, etc.).
