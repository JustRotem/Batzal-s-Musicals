ALTER TABLE "Musical"
ADD COLUMN IF NOT EXISTS "sortOrder" INT;

UPDATE "Musical"
SET "sortOrder" = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" DESC, id) - 1 AS rn
  FROM "Musical"
) AS ordered
WHERE "Musical".id = ordered.id;

ALTER TABLE "Musical"
ALTER COLUMN "sortOrder"
SET DEFAULT 0;

ALTER TABLE "Musical"
ALTER COLUMN "sortOrder"
SET NOT NULL;
