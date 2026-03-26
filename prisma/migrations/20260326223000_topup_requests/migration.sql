CREATE TABLE "TopUpRequest" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderBankName" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopUpRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TopUpRequest_customerId_createdAt_idx"
ON "TopUpRequest"("customerId", "createdAt");

CREATE INDEX "TopUpRequest_status_createdAt_idx"
ON "TopUpRequest"("status", "createdAt");

CREATE INDEX "TopUpRequest_reviewedById_idx"
ON "TopUpRequest"("reviewedById");

ALTER TABLE "TopUpRequest"
ADD CONSTRAINT "TopUpRequest_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TopUpRequest"
ADD CONSTRAINT "TopUpRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
