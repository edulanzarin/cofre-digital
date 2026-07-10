-- AlterTable
ALTER TABLE "VaultConfig" ADD COLUMN     "autoLock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "lockPinHash" TEXT,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false;
