CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_isDraft_publishedAt_idx" ON "BlogPost"("isDraft", "publishedAt");
CREATE INDEX "BlogPost_createdAt_idx" ON "BlogPost"("createdAt");

ALTER TABLE "BlogPost"
ADD CONSTRAINT "BlogPost_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

