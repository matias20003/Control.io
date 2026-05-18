-- Migración manual: crear tabla waitlist_entries.
-- Aplicar UNA SOLA VEZ contra producción (Supabase → SQL editor)
-- o con `npx prisma db push` desde local apuntando a la DB de producción.

CREATE TABLE IF NOT EXISTS "waitlist_entries" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "email"     TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "profile"   TEXT NOT NULL,
  "source"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_entries_email_key"
  ON "waitlist_entries"("email");

CREATE INDEX IF NOT EXISTS "waitlist_entries_createdAt_idx"
  ON "waitlist_entries"("createdAt");
