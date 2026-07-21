-- Migración manual: recordatorios RECURRENTES (repetir lun-vie a tal hora, etc.).
-- Aplicar UNA SOLA VEZ contra producción (Supabase → SQL editor).

CREATE TABLE IF NOT EXISTS "recurring_reminders" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "text"        TEXT NOT NULL,
  "daysOfWeek"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "hour"        INTEGER NOT NULL,
  "minute"      INTEGER NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastFiredOn" DATE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "recurring_reminders_isActive_idx"
  ON "recurring_reminders"("isActive");

ALTER TABLE "recurring_reminders"
  DROP CONSTRAINT IF EXISTS "recurring_reminders_userId_fkey";
ALTER TABLE "recurring_reminders"
  ADD CONSTRAINT "recurring_reminders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
