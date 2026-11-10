-- CreateTable
CREATE TABLE "HorarioCurso" (
    "id" SERIAL NOT NULL,
    "materiaCursoId" INTEGER NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFin" TIME NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorarioCurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Noticia" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "imagenUrl" TEXT,
    "fecha" DATE NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Noticia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consulta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "asunto" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "respondida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEn" TIMESTAMP(3),

    CONSTRAINT "Consulta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorarioCurso_diaSemana_idx" ON "HorarioCurso"("diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioCurso_materiaCursoId_diaSemana_horaInicio_key" ON "HorarioCurso"("materiaCursoId", "diaSemana", "horaInicio");

-- CreateIndex
CREATE INDEX "Noticia_publicada_fecha_idx" ON "Noticia"("publicada", "fecha");

-- CreateIndex
CREATE INDEX "Consulta_respondida_createdAt_idx" ON "Consulta"("respondida", "createdAt");

-- AddForeignKey
ALTER TABLE "HorarioCurso" ADD CONSTRAINT "HorarioCurso_materiaCursoId_fkey" FOREIGN KEY ("materiaCursoId") REFERENCES "MateriaCurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

