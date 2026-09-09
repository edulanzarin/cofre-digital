-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "alteracaoContratual" INTEGER,
ADD COLUMN     "honorarios" INTEGER;

-- CreateTable
CREATE TABLE "CompanyEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyEvent_companyId_createdAt_idx" ON "CompanyEvent"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyEvent" ADD CONSTRAINT "CompanyEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

