-- AlterTable
ALTER TABLE "Access" ADD COLUMN     "certificateId" TEXT;

-- AddForeignKey
ALTER TABLE "Access" ADD CONSTRAINT "Access_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
