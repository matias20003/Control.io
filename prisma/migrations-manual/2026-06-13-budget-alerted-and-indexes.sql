-- Aditivo: anti-spam de alertas de presupuesto + índices de performance.
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "alertedPct" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "transactions_userId_createdAt_idx"
  ON "transactions" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "credit_installments_creditPurchaseId_isPaid_dueDate_idx"
  ON "credit_installments" ("creditPurchaseId", "isPaid", "dueDate");
