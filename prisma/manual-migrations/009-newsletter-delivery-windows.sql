-- Ventanas adicionales para Mi Brief.
-- Migración aditiva: no reemplaza ni transforma configuraciones existentes.

BEGIN;

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "sendHour2" INTEGER;

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "sendHour3" INTEGER;

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "lastDeliveryKey" TEXT;

COMMIT;
