-- Add product access role key
ALTER TABLE "Product"
ADD COLUMN "accessRoleKey" TEXT;

-- Add customer linkage on reviews
ALTER TABLE "Review"
ADD COLUMN "customerId" TEXT;

-- Add guides table
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Guide_productId_isDraft_publishedAt_idx" ON "Guide"("productId", "isDraft", "publishedAt");
CREATE INDEX "Guide_createdAt_idx" ON "Guide"("createdAt");
CREATE INDEX "Review_customerId_createdAt_idx" ON "Review"("customerId", "createdAt");

CREATE UNIQUE INDEX "Review_customerId_productId_key" ON "Review"("customerId", "productId");

ALTER TABLE "Review"
ADD CONSTRAINT "Review_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Guide"
ADD CONSTRAINT "Guide_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
