-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO');

-- CreateTable
CREATE TABLE "Deporte" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Deporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoDeporte" (
    "id" SERIAL NOT NULL,
    "deporteId" INTEGER NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFin" TIME NOT NULL,
    "docenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoDeporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecorridoTransporte" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecorridoTransporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoComedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnoComedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deporte_nombre_key" ON "Deporte"("nombre");

-- CreateIndex
CREATE INDEX "GrupoDeporte_nivelId_idx" ON "GrupoDeporte"("nivelId");

-- CreateIndex
CREATE INDEX "GrupoDeporte_docenteId_idx" ON "GrupoDeporte"("docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoDeporte_deporteId_nivelId_diaSemana_horaInicio_horaFin_key" ON "GrupoDeporte"("deporteId", "nivelId", "diaSemana", "horaInicio", "horaFin");

-- CreateIndex
CREATE UNIQUE INDEX "RecorridoTransporte_nombre_key" ON "RecorridoTransporte"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TurnoComedor_nombre_key" ON "TurnoComedor"("nombre");

-- AddForeignKey
ALTER TABLE "GrupoDeporte" ADD CONSTRAINT "GrupoDeporte_deporteId_fkey" FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoDeporte" ADD CONSTRAINT "GrupoDeporte_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "NivelEducativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoDeporte" ADD CONSTRAINT "GrupoDeporte_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
