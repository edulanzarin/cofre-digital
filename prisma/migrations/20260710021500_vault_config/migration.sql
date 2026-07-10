-- CreateTable
CREATE TABLE "VaultConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "alertDays" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "VaultConfig_pkey" PRIMARY KEY ("id")
);
