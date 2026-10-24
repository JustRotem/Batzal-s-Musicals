CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameScore_userId_game_key" ON "GameScore"("userId", "game");
CREATE INDEX "GameScore_game_score_idx" ON "GameScore"("game", "score");

ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
