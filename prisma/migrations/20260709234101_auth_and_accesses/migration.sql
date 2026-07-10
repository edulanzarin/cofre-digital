-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('SOCIETARIO', 'FISCAL', 'CONTABIL', 'DP', 'CONTROLADORIA', 'COMERCIAL', 'ADMINISTRATIVO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sector" "Sector" NOT NULL DEFAULT 'ADMINISTRATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Access" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "loginType" TEXT NOT NULL,
    "loginValue" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "notes" TEXT,
    "tutorial" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialImage" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
