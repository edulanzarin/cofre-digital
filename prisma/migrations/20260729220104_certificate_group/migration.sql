-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Certificate_groupId_idx" ON "Certificate"("groupId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompanyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
