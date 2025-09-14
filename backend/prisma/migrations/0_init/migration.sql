-- CreateEnum
CREATE TYPE "Position" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'PART_TIME');

-- CreateEnum
CREATE TYPE "Section" AS ENUM ('HALL', 'KITCHEN');

-- CreateEnum
CREATE TYPE "PayUnit" AS ENUM ('MONTHLY', 'HOURLY');

-- CreateEnum
CREATE TYPE "ShiftReviewReason" AS ENUM ('LATE_IN', 'EARLY_OUT', 'LATE_OUT', 'EXTENDED', 'NO_ATTENDANCE');

-- CreateEnum
CREATE TYPE "WorkShiftStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'MISSED', 'OVERDUE', 'REVIEW', 'NO_ATTENDANCE');

-- CreateTable
CREATE TABLE "Shop" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyWage" INTEGER NOT NULL,
    "payday" INTEGER NOT NULL,
    "qrSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bank" TEXT NOT NULL DEFAULT '',
    "position" "Position" NOT NULL DEFAULT 'STAFF',
    "section" "Section" NOT NULL DEFAULT 'HALL',
    "pay" INTEGER NOT NULL,
    "payUnit" "PayUnit" NOT NULL,
    "nationalIdEnc" TEXT,
    "nationalIdHash" VARCHAR(64),
    "nationalIdMasked" VARCHAR(32),
    "personalColor" VARCHAR(7) DEFAULT '#1F6FEB',

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "actualInAt" TIMESTAMP(3),
    "actualOutAt" TIMESTAMP(3),
    "late" BOOLEAN DEFAULT false,
    "leftEarly" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,
    "actualMinutes" INTEGER,
    "settlementId" INTEGER,
    "workedMinutes" INTEGER,
    "status" "WorkShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reviewReason" "ShiftReviewReason",
    "reviewResolvedAt" TIMESTAMP(3),
    "reviewedBy" INTEGER,
    "finalPayAmount" INTEGER,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSettlement" (
    "id" SERIAL NOT NULL,
    "shopId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "workedMinutes" INTEGER NOT NULL,
    "basePay" INTEGER NOT NULL,
    "totalPay" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedBy" INTEGER,
    "note" TEXT,
    "incomeTax" INTEGER NOT NULL DEFAULT 0,
    "localIncomeTax" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL DEFAULT 0,
    "otherTax" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_employee_nationalIdHash" ON "Employee"("nationalIdHash");

-- CreateIndex
CREATE INDEX "WorkShift_shopId_employeeId_startAt_idx" ON "WorkShift"("shopId", "employeeId", "startAt");

-- CreateIndex
CREATE INDEX "WorkShift_employeeId_status_idx" ON "WorkShift"("employeeId", "status");

-- CreateIndex
CREATE INDEX "WorkShift_settlementId_idx" ON "WorkShift"("settlementId");

-- CreateIndex
CREATE INDEX "WorkShift_shopId_employeeId_isSettled_idx" ON "WorkShift"("shopId", "employeeId", "isSettled");

-- CreateIndex
CREATE INDEX "PayrollSettlement_shopId_idx" ON "PayrollSettlement"("shopId");

-- CreateIndex
CREATE INDEX "PayrollSettlement_shopId_cycleStart_cycleEnd_idx" ON "PayrollSettlement"("shopId", "cycleStart", "cycleEnd");

-- CreateIndex
CREATE INDEX "PayrollSettlement_employeeId_cycleStart_cycleEnd_idx" ON "PayrollSettlement"("employeeId", "cycleStart", "cycleEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettlement_employeeId_cycleStart_cycleEnd_key" ON "PayrollSettlement"("employeeId", "cycleStart", "cycleEnd");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "PayrollSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

