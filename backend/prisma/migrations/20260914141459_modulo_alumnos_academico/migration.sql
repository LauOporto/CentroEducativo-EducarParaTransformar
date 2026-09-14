-- CreateEnum
CREATE TYPE "EstadoAlumno" AS ENUM ('ACTIVO', 'INACTIVO', 'EGRESADO');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "curso",
ADD COLUMN     "apellido" TEXT,
ADD COLUMN     "cursoId" INTEGER,
ADD COLUMN     "domicilio" TEXT,
ADD COLUMN     "estado" "EstadoAlumno",
ADD COLUMN     "fechaNacimiento" DATE,
ADD COLUMN     "legajo" TEXT,
ADD COLUMN     "telefono" TEXT;

-- CreateTable
CREATE TABLE "NivelEducativo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "NivelEducativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivelId" INTEGER NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MateriaCurso" (
    "id" SERIAL NOT NULL,
    "materiaId" INTEGER NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MateriaCurso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NivelEducativo_nombre_key" ON "NivelEducativo"("nombre");

-- CreateIndex
CREATE INDEX "Curso_nivelId_idx" ON "Curso"("nivelId");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_nombre_nivelId_key" ON "Curso"("nombre", "nivelId");

-- CreateIndex
CREATE UNIQUE INDEX "Materia_nombre_key" ON "Materia"("nombre");

-- CreateIndex
CREATE INDEX "MateriaCurso_cursoId_idx" ON "MateriaCurso"("cursoId");

-- CreateIndex
CREATE INDEX "MateriaCurso_docenteId_idx" ON "MateriaCurso"("docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "MateriaCurso_materiaId_cursoId_docenteId_key" ON "MateriaCurso"("materiaId", "cursoId", "docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "User_legajo_key" ON "User"("legajo");

-- CreateIndex
CREATE INDEX "User_cursoId_idx" ON "User"("cursoId");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "NivelEducativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaCurso" ADD CONSTRAINT "MateriaCurso_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaCurso" ADD CONSTRAINT "MateriaCurso_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaCurso" ADD CONSTRAINT "MateriaCurso_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

