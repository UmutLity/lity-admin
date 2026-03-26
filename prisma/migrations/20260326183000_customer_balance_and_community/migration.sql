-- Customer wallet fields
ALTER TABLE "Customer"
ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Order relation and payment metadata
ALTER TABLE "Order"
ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'BALANCE';

ALTER TABLE "Order"
ADD CONSTRAINT "Order_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Balance transaction ledger
CREATE TABLE "BalanceTransaction" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "balanceBefore" DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "reason" TEXT,
  "adminUserId" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BalanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalanceTransaction_customerId_createdAt_idx"
ON "BalanceTransaction"("customerId", "createdAt");

CREATE INDEX "BalanceTransaction_type_createdAt_idx"
ON "BalanceTransaction"("type", "createdAt");

ALTER TABLE "BalanceTransaction"
ADD CONSTRAINT "BalanceTransaction_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Community chat messages
CREATE TABLE "CommunityMessage" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityMessage_createdAt_idx"
ON "CommunityMessage"("createdAt");

CREATE INDEX "CommunityMessage_customerId_createdAt_idx"
ON "CommunityMessage"("customerId", "createdAt");

ALTER TABLE "CommunityMessage"
ADD CONSTRAINT "CommunityMessage_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
