CREATE TABLE "QrHistory" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "logoSize" INTEGER NOT NULL DEFAULT 30,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "QrHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QrHistory_userId_createdAt_idx" ON "QrHistory"("userId", "createdAt");

ALTER TABLE "QrHistory" ADD CONSTRAINT "QrHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
