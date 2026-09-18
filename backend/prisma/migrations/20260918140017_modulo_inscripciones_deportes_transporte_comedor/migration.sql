-- CreateTable
CREATE TABLE "InscripcionDeporte" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "deporteId" INTEGER NOT NULL,
    "grupoDeporteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscripcionDeporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscripcionTransporte" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "recorridoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InscripcionTransporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscripcionComedor" (
    "id" SERIAL NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InscripcionComedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InscripcionDeporte_grupoDeporteId_idx" ON "InscripcionDeporte"("grupoDeporteId");

-- CreateIndex
CREATE UNIQUE INDEX "InscripcionDeporte_estudianteId_deporteId_key" ON "InscripcionDeporte"("estudianteId", "deporteId");

-- CreateIndex
CREATE UNIQUE INDEX "InscripcionTransporte_estudianteId_key" ON "InscripcionTransporte"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "InscripcionComedor_estudianteId_key" ON "InscripcionComedor"("estudianteId");

-- AddForeignKey
ALTER TABLE "InscripcionDeporte" ADD CONSTRAINT "InscripcionDeporte_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionDeporte" ADD CONSTRAINT "InscripcionDeporte_deporteId_fkey" FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionDeporte" ADD CONSTRAINT "InscripcionDeporte_grupoDeporteId_fkey" FOREIGN KEY ("grupoDeporteId") REFERENCES "GrupoDeporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionTransporte" ADD CONSTRAINT "InscripcionTransporte_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionTransporte" ADD CONSTRAINT "InscripcionTransporte_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "RecorridoTransporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionComedor" ADD CONSTRAINT "InscripcionComedor_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionComedor" ADD CONSTRAINT "InscripcionComedor_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoComedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

