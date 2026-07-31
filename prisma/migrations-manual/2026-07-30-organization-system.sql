-- Sistema unificado de organización. Migración aditiva y compatible con tareas existentes.
CREATE TABLE IF NOT EXISTS "organization_lists" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#2563eb',
  "icon" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isInbox" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "organization_lists_userId_name_key" ON "organization_lists"("userId", "name");
CREATE INDEX IF NOT EXISTS "organization_lists_userId_position_idx" ON "organization_lists"("userId", "position");

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "listId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduledStart" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduledEnd" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'TODO';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "urgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "important" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrenceRule" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "reminderMinutes" INTEGER;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CONTROL_IO';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "googleEtag" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "googleUpdatedAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "syncError" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "tasks" SET "status" = CASE WHEN "done" THEN 'DONE' ELSE 'TODO' END;
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "organization_lists"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "tasks_userId_status_scheduledStart_idx" ON "tasks"("userId", "status", "scheduledStart");
CREATE INDEX IF NOT EXISTS "tasks_listId_status_order_idx" ON "tasks"("listId", "status", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_userId_googleCalendarId_googleEventId_key"
  ON "tasks"("userId", "googleCalendarId", "googleEventId");

CREATE TABLE IF NOT EXISTS "habits" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "color" TEXT NOT NULL DEFAULT '#2563eb',
  "frequency" TEXT NOT NULL DEFAULT 'DAILY',
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT '{}',
  "targetPerPeriod" INTEGER NOT NULL DEFAULT 1,
  "scheduledTime" TEXT,
  "googleEventId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "habits_userId_isActive_idx" ON "habits"("userId", "isActive");

CREATE TABLE IF NOT EXISTS "habit_completions" (
  "id" TEXT PRIMARY KEY,
  "habitId" TEXT NOT NULL REFERENCES "habits"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "habit_completions_habitId_date_key" ON "habit_completions"("habitId", "date");
CREATE INDEX IF NOT EXISTS "habit_completions_date_idx" ON "habit_completions"("date");

CREATE TABLE IF NOT EXISTS "google_calendar_sync" (
  "userId" TEXT PRIMARY KEY REFERENCES "profiles"("id") ON DELETE CASCADE,
  "calendarId" TEXT,
  "syncToken" TEXT,
  "channelId" TEXT UNIQUE,
  "channelToken" TEXT,
  "resourceId" TEXT,
  "channelExpiresAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
