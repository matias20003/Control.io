-- Migración manual: tabla feedback (reportes de testers del beta).
-- Aditiva, no destructiva. Aplicar UNA SOLA VEZ contra producción.
-- RLS deny-all: solo se accede vía Prisma (rol postgres con BYPASSRLS).

CREATE TABLE IF NOT EXISTS "feedback" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT,
  "email"     TEXT,
  "message"   TEXT NOT NULL,
  "page"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "feedback_createdAt_idx" ON "feedback" ("createdAt");

ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
