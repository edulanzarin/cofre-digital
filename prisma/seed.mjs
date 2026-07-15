// Cria os perfis de acesso padrão e o usuário administrador inicial
// se o banco estiver vazio. Roda no serviço "migrate" do compose,
// depois do migrate deploy.
import pg from "pg";
import bcrypt from "bcryptjs";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Perfis padrão — a migração já cria em bancos existentes; aqui cobre
// bancos novos criados direto pelo migrate deploy.
await client.query(
  `INSERT INTO "PermissionProfile" (id, name, admin, rules, "updatedAt")
   VALUES
     (gen_random_uuid()::text, 'Administrador', true,
      '{"empresas":"edit","certificados":"edit","acessos":"edit"}', CURRENT_TIMESTAMP),
     (gen_random_uuid()::text, 'Visualização', false,
      '{"empresas":"view","certificados":"view","acessos":"view"}', CURRENT_TIMESTAMP)
   ON CONFLICT (name) DO NOTHING`,
);

const {
  rows: [{ n }],
} = await client.query('SELECT COUNT(*)::int AS n FROM "User"');

if (n === 0) {
  // "||" e não "??": o compose passa string vazia quando a env não existe.
  const name = process.env.SEED_ADMIN_NAME || "Eduardo Lanzarin";
  const email = process.env.SEED_ADMIN_EMAIL || "eduardo.lanzarin@navecon.net.br";
  // Senha inicial: defina SEED_ADMIN_PASSWORD no .env antes do primeiro up,
  // ou entre com a padrão e troque na página Equipe.
  const password = process.env.SEED_ADMIN_PASSWORD || "trocar@123";
  const hash = bcrypt.hashSync(password, 10);
  await client.query(
    `INSERT INTO "User" (id, name, email, "passwordHash", sector, "profileId")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'SOCIETARIO',
             (SELECT id FROM "PermissionProfile" WHERE admin LIMIT 1))`,
    [name, email, hash],
  );
  console.log(`Administrador do cofre criado: ${email}`);
} else {
  console.log("Usuários já existem — seed ignorado.");
}

await client.end();
