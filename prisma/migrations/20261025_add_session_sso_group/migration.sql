ALTER TABLE "Session" ADD COLUMN "ssoGroup" TEXT;
CREATE INDEX "Session_ssoGroup_idx" ON "Session"("ssoGroup");
