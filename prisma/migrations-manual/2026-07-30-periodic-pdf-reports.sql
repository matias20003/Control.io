ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "reportFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN IF NOT EXISTS "reportNotifyApp" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "reportNotifyWhatsapp" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "reportNotifyEmail" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "report_deliveries" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "frequency" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publicToken" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_deliveries_userId_frequency_periodStart_periodEnd_key"
  ON "report_deliveries" ("userId", "frequency", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "report_deliveries_userId_createdAt_idx"
  ON "report_deliveries" ("userId", "createdAt");
