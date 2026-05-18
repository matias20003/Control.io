-- Migración manual: agregar accountId a recurring_transactions.
-- Aplicar UNA SOLA VEZ contra la DB de producción (Supabase → SQL editor).
--
-- También se puede aplicar con:
--   npx prisma db push
-- desde local con DATABASE_URL apuntando a producción (Prisma detecta el
-- diff con el schema y aplica las mismas operaciones).

ALTER TABLE "recurring_transactions"
  ADD COLUMN IF NOT EXISTS "accountId" TEXT;

ALTER TABLE "recurring_transactions"
  DROP CONSTRAINT IF EXISTS "recurring_transactions_accountId_fkey";

ALTER TABLE "recurring_transactions"
  ADD CONSTRAINT "recurring_transactions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
