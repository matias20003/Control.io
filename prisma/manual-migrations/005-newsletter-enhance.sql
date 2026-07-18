-- Migración manual: mejoras del newsletter (prioridad de temas + horario configurable).
-- Aplicar UNA SOLA VEZ contra producción (Supabase → SQL editor)
-- o con `npx prisma db push` desde local apuntando a la DB de producción.

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "priorityTopics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "sendHour" INTEGER NOT NULL DEFAULT 8;
