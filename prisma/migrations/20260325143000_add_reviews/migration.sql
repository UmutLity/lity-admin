-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_source_sourceMessageId_key" ON "Review"("source", "sourceMessageId");

-- CreateIndex
CREATE INDEX "Review_isVisible_createdAt_idx" ON "Review"("isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "Review_source_createdAt_idx" ON "Review"("source", "createdAt");
