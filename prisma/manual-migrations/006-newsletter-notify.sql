-- Migración manual: recordatorio del newsletter (avisar cuando la edición esté lista).
-- Aplicar UNA SOLA VEZ contra producción (Supabase → SQL editor).

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "notifyOnReady" BOOLEAN NOT NULL DEFAULT true;
