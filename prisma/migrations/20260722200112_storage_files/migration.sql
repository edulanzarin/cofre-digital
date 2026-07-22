-- AlterTable
ALTER TABLE "Alvara" ADD COLUMN     "filePath" TEXT;

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "filePath" TEXT;

-- AlterTable
ALTER TABLE "TutorialImage" ADD COLUMN     "filePath" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VaultConfig" ADD COLUMN     "storageRoot" TEXT;
