/*
  Warnings:

  - You are about to drop the `Activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Announcement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Submission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_docenteId_fkey";

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_estudianteId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_padreId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_activityId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_estudianteId_fkey";

-- DropTable
DROP TABLE "Activity";

-- DropTable
DROP TABLE "Announcement";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "Submission";

-- DropEnum
DROP TYPE "ActivityType";

-- DropEnum
DROP TYPE "AnnouncementTarget";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "SubmissionStatus";
