-- Perfis de acesso reutilizáveis (padrões de configuração por usuário)
CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PermissionProfile_name_key" ON "PermissionProfile"("name");

ALTER TABLE "User" ADD COLUMN "profileId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Empresas: cada uma é dona de um cofre (certificados, acessos, ...)
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

ALTER TABLE "Certificate" ADD COLUMN "companyId" TEXT;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Access" ADD COLUMN "companyId" TEXT;

ALTER TABLE "Access" ADD CONSTRAINT "Access_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Linha do tempo dos certificados
CREATE TABLE "CertificateEvent" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CertificateEvent_certificateId_createdAt_idx"
    ON "CertificateEvent"("certificateId", "createdAt");

ALTER TABLE "CertificateEvent" ADD CONSTRAINT "CertificateEvent_certificateId_fkey"
    FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Backfill dos dados existentes
-- ============================================================

-- Perfis padrão: Administrador (tudo) e Visualização (só leitura)
INSERT INTO "PermissionProfile" ("id", "name", "admin", "rules", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Administrador', true,
     '{"empresas":"edit","certificados":"edit","acessos":"edit"}', CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Visualização', false,
     '{"empresas":"view","certificados":"view","acessos":"view"}', CURRENT_TIMESTAMP);

-- Societário era o administrador; os demais setores só liam
UPDATE "User" SET "profileId" = (SELECT "id" FROM "PermissionProfile" WHERE "admin")
WHERE "sector" = 'SOCIETARIO';

UPDATE "User" SET "profileId" = (SELECT "id" FROM "PermissionProfile" WHERE "name" = 'Visualização')
WHERE "profileId" IS NULL;

-- Cria empresas a partir dos certificados e-CNPJ já guardados
-- (documento com 14 dígitos) e vincula os certificados a elas
INSERT INTO "Company" ("id", "cnpj", "razaoSocial", "updatedAt")
SELECT gen_random_uuid()::text, c."doc", c."holder", CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (regexp_replace("document", '\D', '', 'g'))
        regexp_replace("document", '\D', '', 'g') AS "doc",
        "holder"
    FROM "Certificate"
    WHERE length(regexp_replace("document", '\D', '', 'g')) = 14
    ORDER BY regexp_replace("document", '\D', '', 'g'), "createdAt" DESC
) c
ON CONFLICT ("cnpj") DO NOTHING;

UPDATE "Certificate" ct
SET "companyId" = co."id"
FROM "Company" co
WHERE regexp_replace(ct."document", '\D', '', 'g') = co."cnpj"
  AND ct."companyId" IS NULL;

-- Histórico: registra o cadastro dos certificados que já existem
INSERT INTO "CertificateEvent" ("id", "certificateId", "kind", "userName", "createdAt")
SELECT gen_random_uuid()::text, "id", 'created', 'Sistema', "createdAt"
FROM "Certificate";
