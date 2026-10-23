-- Library sections: editors manage them, every item belongs to at most one
CREATE TABLE "LibraryCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "emoji" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibraryCategory_slug_key" ON "LibraryCategory"("slug");

ALTER TABLE "Musical" ADD COLUMN "categoryId" TEXT;
CREATE INDEX "Musical_categoryId_idx" ON "Musical"("categoryId");
ALTER TABLE "Musical" ADD CONSTRAINT "Musical_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LibraryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Everything that exists today is a musical
INSERT INTO "LibraryCategory" ("id", "slug", "nameHe", "nameEn", "emoji", "sortOrder", "updatedAt")
VALUES ('cat_musicals', 'musicals', 'מחזות זמר', 'Musicals', '🎭', 0, CURRENT_TIMESTAMP);
UPDATE "Musical" SET "categoryId" = 'cat_musicals';
