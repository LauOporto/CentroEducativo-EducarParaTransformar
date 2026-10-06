-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('INTERNA', 'EMAIL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canalNotificacion" "CanalNotificacion" NOT NULL DEFAULT 'INTERNA';

