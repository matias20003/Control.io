-- Precisión para saldos y movimientos de criptomonedas (por ejemplo BTC).
ALTER TABLE "accounts"
  ALTER COLUMN "balance" TYPE DECIMAL(24,8);

ALTER TABLE "transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(24,8),
  ALTER COLUMN "destinationAmount" TYPE DECIMAL(24,8);
