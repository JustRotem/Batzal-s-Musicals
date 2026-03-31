DO $$
BEGIN
  CREATE TYPE "PosterAspect" AS ENUM ('square', 'wide', 'tall');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Musical"
  ADD COLUMN IF NOT EXISTS "posterAspect" TEXT;

UPDATE "Musical"
SET "posterAspect" = 'square'
WHERE "posterAspect" IS NULL
   OR "posterAspect" NOT IN ('square', 'wide', 'tall');

ALTER TABLE "Musical"
  ALTER COLUMN "posterAspect" TYPE "PosterAspect" USING ("posterAspect"::text::"PosterAspect");

ALTER TABLE "Musical"
  ALTER COLUMN "posterAspect" SET DEFAULT 'square';
