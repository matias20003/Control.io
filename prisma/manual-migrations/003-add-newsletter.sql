-- Migración manual: newsletter de noticias personalizadas.
-- Aplicar UNA SOLA VEZ contra producción (Supabase → SQL editor)
-- o con `npx prisma db push` desde local apuntando a la DB de producción.

CREATE TABLE IF NOT EXISTS "newsletter_configs" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "topics"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "language"  TEXT NOT NULL DEFAULT 'es',
  "country"   TEXT NOT NULL DEFAULT 'ar',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_configs_userId_key"
  ON "newsletter_configs"("userId");

ALTER TABLE "newsletter_configs"
  DROP CONSTRAINT IF EXISTS "newsletter_configs_userId_fkey";
ALTER TABLE "newsletter_configs"
  ADD CONSTRAINT "newsletter_configs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "newsletter_editions" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "date"      TIMESTAMP(3) NOT NULL,
  "summary"   TEXT NOT NULL,
  "articles"  JSONB NOT NULL,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_editions_userId_date_key"
  ON "newsletter_editions"("userId", "date");
CREATE INDEX IF NOT EXISTS "newsletter_editions_userId_date_idx"
  ON "newsletter_editions"("userId", "date");

ALTER TABLE "newsletter_editions"
  DROP CONSTRAINT IF EXISTS "newsletter_editions_userId_fkey";
ALTER TABLE "newsletter_editions"
  ADD CONSTRAINT "newsletter_editions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
