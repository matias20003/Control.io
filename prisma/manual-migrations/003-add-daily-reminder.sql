-- Migración manual: agregar dailyReminderEnabled a profiles.
-- Recordatorio diario por WhatsApp (20hs ARG) configurable por usuario.
-- Aplicar UNA SOLA VEZ contra la DB de producción. Aditiva, no destructiva.

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
