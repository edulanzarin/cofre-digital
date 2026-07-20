-- Alvarás e licenças das empresas (funcionamento, sanitário, bombeiros…)
-- com o PDF do documento guardado no cofre
CREATE TABLE "Alvara" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileName" TEXT,
    "fileData" TEXT,
    "notes" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alvara_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Alvara" ADD CONSTRAINT "Alvara_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Linha do tempo dos alvarás
CREATE TABLE "AlvaraEvent" (
    "id" TEXT NOT NULL,
    "alvaraId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlvaraEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlvaraEvent_alvaraId_createdAt_idx"
    ON "AlvaraEvent"("alvaraId", "createdAt");

ALTER TABLE "AlvaraEvent" ADD CONSTRAINT "AlvaraEvent_alvaraId_fkey"
    FOREIGN KEY ("alvaraId") REFERENCES "Alvara"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Perfis existentes: o módulo de alvarás entra com o mesmo nível
-- que o perfil já tem em certificados (documentos do mesmo cofre)
UPDATE "PermissionProfile"
SET "rules" = jsonb_set("rules", '{alvaras}', to_jsonb("rules"->>'certificados'))
WHERE "rules" ? 'certificados';
