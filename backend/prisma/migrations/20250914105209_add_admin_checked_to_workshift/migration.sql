/*
  Warnings:

  - The values [MISSED,OVERDUE,NO_ATTENDANCE] on the enum `WorkShiftStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WorkShiftStatus_new" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'REVIEW');
ALTER TABLE "WorkShift" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WorkShift" ALTER COLUMN "status" TYPE "WorkShiftStatus_new" USING ("status"::text::"WorkShiftStatus_new");
ALTER TYPE "WorkShiftStatus" RENAME TO "WorkShiftStatus_old";
ALTER TYPE "WorkShiftStatus_new" RENAME TO "WorkShiftStatus";
DROP TYPE "WorkShiftStatus_old";
ALTER TABLE "WorkShift" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterTable
ALTER TABLE "WorkShift" ADD COLUMN     "adminChecked" BOOLEAN NOT NULL DEFAULT false;
