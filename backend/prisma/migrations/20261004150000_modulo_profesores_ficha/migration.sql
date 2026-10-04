-- CreateEnum
CREATE TYPE "EstadoProfesor" AS ENUM ('ACTIVO', 'LICENCIA', 'INACTIVO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "especialidad" TEXT,
ADD COLUMN     "estadoProfesor" "EstadoProfesor";

-- Docentes ya existentes: estado coherente con el login habilitado.
UPDATE "User"
SET "estadoProfesor" = CASE WHEN "isActive" THEN 'ACTIVO'::"EstadoProfesor" ELSE 'INACTIVO'::"EstadoProfesor" END
WHERE "role" = 'DOCENTE';
