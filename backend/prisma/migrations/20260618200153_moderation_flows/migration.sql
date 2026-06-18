-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "Inscription" (
    "id" SERIAL NOT NULL,
    "nombreTutor" TEXT NOT NULL,
    "emailTutor" TEXT NOT NULL,
    "telefonoTutor" TEXT NOT NULL,
    "nombreEstudiante" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "mensaje" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notaAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opinion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT,
    "rol" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Opinion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentApplication" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "puesto" TEXT NOT NULL,
    "cvUrl" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notaAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EmploymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inscription_status_idx" ON "Inscription"("status");

-- CreateIndex
CREATE INDEX "Inscription_createdAt_idx" ON "Inscription"("createdAt");

-- CreateIndex
CREATE INDEX "Opinion_status_idx" ON "Opinion"("status");

-- CreateIndex
CREATE INDEX "Opinion_createdAt_idx" ON "Opinion"("createdAt");

-- CreateIndex
CREATE INDEX "EmploymentApplication_status_idx" ON "EmploymentApplication"("status");

-- CreateIndex
CREATE INDEX "EmploymentApplication_createdAt_idx" ON "EmploymentApplication"("createdAt");
