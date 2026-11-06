-- CreateEnum
CREATE TYPE "TipoRecordatorio" AS ENUM ('EMISION', 'DEUDA');

-- CreateTable
CREATE TABLE "EnvioRecordatorio" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoRecordatorio" NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "padreId" INTEGER NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'EMAIL',
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioRecordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvioRecordatorio_enviadoEn_idx" ON "EnvioRecordatorio"("enviadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioRecordatorio_tipo_facturaId_padreId_key" ON "EnvioRecordatorio"("tipo", "facturaId", "padreId");

-- AddForeignKey
ALTER TABLE "EnvioRecordatorio" ADD CONSTRAINT "EnvioRecordatorio_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioRecordatorio" ADD CONSTRAINT "EnvioRecordatorio_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

