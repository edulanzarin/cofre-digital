-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CertMedia" AS ENUM ('FILE', 'CARD');

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "media" "CertMedia" NOT NULL DEFAULT 'FILE',
    "issuer" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT NOT NULL,
    "fileName" TEXT,
    "fileData" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

