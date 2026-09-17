-- AlterTable
ALTER TABLE "Alvara" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'alvara';

-- Os já cadastrados como dispensa ou declaração só diziam isso no nome
-- (a dispensa era uma sugestão do campo de texto livre).
UPDATE "Alvara" SET "kind" = 'dispensa' WHERE "name" ILIKE 'dispensa%';
UPDATE "Alvara" SET "kind" = 'declaracao' WHERE "name" ILIKE 'declara%';
