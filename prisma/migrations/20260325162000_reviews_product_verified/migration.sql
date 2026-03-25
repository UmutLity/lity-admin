-- AlterTable
ALTER TABLE "Review"
ADD COLUMN "productId" TEXT,
ADD COLUMN "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Review_productId_createdAt_idx" ON "Review"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "Review"
ADD CONSTRAINT "Review_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
