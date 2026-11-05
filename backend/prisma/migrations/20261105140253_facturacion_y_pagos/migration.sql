-- CreateEnum
CREATE TYPE "ConceptoCuota" AS ENUM ('CUOTA', 'DEPORTE', 'TRANSPORTE', 'COMEDOR');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'EN_REVISION', 'PAGADA');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('GENERADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA');

-- AlterTable
ALTER TABLE "Deporte" ADD COLUMN     "precioMensual" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NivelEducativo" ADD COLUMN     "cuotaMensual" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RecorridoTransporte" ADD COLUMN     "precioMensual" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TurnoComedor" ADD COLUMN     "precioMensual" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Factura" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "emitidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimiento" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" SERIAL NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "concepto" "ConceptoCuota" NOT NULL,
    "referenciaId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "vencimiento" DATE NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobantePago" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "generadoPorId" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "medio" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'GENERADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivoId" TEXT,
    "archivoTipo" TEXT,
    "nroOperacion" TEXT,
    "fechaTransferencia" DATE,
    "montoTransferido" DECIMAL(12,2),
    "cargadoEn" TIMESTAMP(3),
    "revisadoPorId" INTEGER,
    "revisadoEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,

    CONSTRAINT "ComprobantePago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobantePagoItem" (
    "id" SERIAL NOT NULL,
    "comprobanteId" INTEGER NOT NULL,
    "cuotaId" INTEGER NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ComprobantePagoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "comprobanteId" INTEGER NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "estudianteId" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaAcreditacion" TIMESTAMP(3) NOT NULL,
    "registradoPorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

-- CreateIndex
CREATE INDEX "Factura_periodo_idx" ON "Factura"("periodo");

-- CreateIndex
CREATE INDEX "Factura_estado_idx" ON "Factura"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_estudianteId_periodo_key" ON "Factura"("estudianteId", "periodo");

-- CreateIndex
CREATE INDEX "Cuota_estudianteId_estado_idx" ON "Cuota"("estudianteId", "estado");

-- CreateIndex
CREATE INDEX "Cuota_concepto_referenciaId_idx" ON "Cuota"("concepto", "referenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_facturaId_concepto_referenciaId_key" ON "Cuota"("facturaId", "concepto", "referenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComprobantePago_numero_key" ON "ComprobantePago"("numero");

-- CreateIndex
CREATE INDEX "ComprobantePago_facturaId_idx" ON "ComprobantePago"("facturaId");

-- CreateIndex
CREATE INDEX "ComprobantePago_estado_idx" ON "ComprobantePago"("estado");

-- CreateIndex
CREATE INDEX "ComprobantePagoItem_cuotaId_idx" ON "ComprobantePagoItem"("cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComprobantePagoItem_comprobanteId_cuotaId_key" ON "ComprobantePagoItem"("comprobanteId", "cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_comprobanteId_key" ON "Pago"("comprobanteId");

-- CreateIndex
CREATE INDEX "Pago_fechaAcreditacion_idx" ON "Pago"("fechaAcreditacion");

-- CreateIndex
CREATE INDEX "Pago_estudianteId_idx" ON "Pago"("estudianteId");

-- CreateIndex
CREATE INDEX "Pago_facturaId_idx" ON "Pago"("facturaId");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePagoItem" ADD CONSTRAINT "ComprobantePagoItem_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "ComprobantePago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePagoItem" ADD CONSTRAINT "ComprobantePagoItem_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "ComprobantePago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
