-- Transferencias multimoneda: snapshot de ambos importes y de la cotización usada.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "destinationAmount" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "destinationCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "rateBaseCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "rateQuoteCurrency" TEXT;

ALTER TABLE "transactions"
  ALTER COLUMN "exchangeRate" TYPE DECIMAL(18,8);

-- Las transferencias históricas eran 1:1. Se conserva explícitamente ese efecto.
UPDATE "transactions"
SET
  "destinationAmount" = "amount",
  "destinationCurrency" = "currency",
  "rateBaseCurrency" = "currency",
  "rateQuoteCurrency" = "currency"
WHERE "type" = 'TRANSFER' AND "destinationAmount" IS NULL;
