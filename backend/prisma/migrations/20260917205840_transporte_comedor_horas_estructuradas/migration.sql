-- Reemplaza el campo `horario` (texto libre) de RecorridoTransporte y
-- TurnoComedor por horas estructuradas (@db.Time), igual criterio que
-- GrupoDeporte. Ninguna otra tabla referencia estos catálogos, por eso el
-- TRUNCATE es seguro (los datos se recargan con el seed).
TRUNCATE TABLE "RecorridoTransporte", "TurnoComedor";

-- AlterTable
ALTER TABLE "RecorridoTransporte"
  DROP COLUMN "horario",
  ADD COLUMN "horaSalida" TIME NOT NULL,
  ADD COLUMN "horaRegreso" TIME NOT NULL;

-- AlterTable
ALTER TABLE "TurnoComedor"
  DROP COLUMN "horario",
  ADD COLUMN "horaInicio" TIME NOT NULL,
  ADD COLUMN "horaFin" TIME NOT NULL;
