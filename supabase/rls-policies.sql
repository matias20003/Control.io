-- ══════════════════════════════════════════════════════════════════════════
-- Control.io — Row Level Security Policies
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════════════
-- Nota: Prisma conecta vía DATABASE_URL (postgres superuser) y bypasea RLS.
-- Estas políticas protegen el acceso directo vía API/anon key.
-- ══════════════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  USING (id = auth.uid()::text);

-- ── accounts ─────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts_own" ON accounts;
CREATE POLICY "accounts_own" ON accounts
  USING ("userId" = auth.uid()::text);

-- ── categories ───────────────────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_own" ON categories;
CREATE POLICY "categories_own" ON categories
  USING ("userId" = auth.uid()::text);

-- ── transactions ─────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_own" ON transactions;
CREATE POLICY "transactions_own" ON transactions
  USING ("userId" = auth.uid()::text);

-- ── investments ──────────────────────────────────────────────────────────
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investments_own" ON investments;
CREATE POLICY "investments_own" ON investments
  USING ("userId" = auth.uid()::text);

-- ── debts ────────────────────────────────────────────────────────────────
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debts_own" ON debts;
CREATE POLICY "debts_own" ON debts
  USING ("userId" = auth.uid()::text);

-- ── debt_installments ────────────────────────────────────────────────────
ALTER TABLE debt_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debt_installments_own" ON debt_installments;
CREATE POLICY "debt_installments_own" ON debt_installments
  USING (
    EXISTS (
      SELECT 1 FROM debts
      WHERE debts.id = debt_installments."debtId"
        AND debts."userId" = auth.uid()::text
    )
  );

-- ── credit_purchases ─────────────────────────────────────────────────────
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_purchases_own" ON credit_purchases;
CREATE POLICY "credit_purchases_own" ON credit_purchases
  USING ("userId" = auth.uid()::text);

-- ── credit_installments ──────────────────────────────────────────────────
ALTER TABLE credit_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_installments_own" ON credit_installments;
CREATE POLICY "credit_installments_own" ON credit_installments
  USING (
    EXISTS (
      SELECT 1 FROM credit_purchases
      WHERE credit_purchases.id = credit_installments."creditPurchaseId"
        AND credit_purchases."userId" = auth.uid()::text
    )
  );

-- ── recurring_transactions ───────────────────────────────────────────────
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_own" ON recurring_transactions;
CREATE POLICY "recurring_own" ON recurring_transactions
  USING ("userId" = auth.uid()::text);

-- ── budgets ──────────────────────────────────────────────────────────────
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budgets_own" ON budgets;
CREATE POLICY "budgets_own" ON budgets
  USING ("userId" = auth.uid()::text);

-- ── goals ────────────────────────────────────────────────────────────────
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goals_own" ON goals;
CREATE POLICY "goals_own" ON goals
  USING ("userId" = auth.uid()::text);

-- ── push_subscriptions ───────────────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  USING ("userId" = auth.uid()::text);

-- ── mfa_recovery_codes ───────────────────────────────────────────────────
ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mfa_recovery_codes_own" ON mfa_recovery_codes;
CREATE POLICY "mfa_recovery_codes_own" ON mfa_recovery_codes
  USING ("userId" = auth.uid()::text);

-- ── exchange_rates ───────────────────────────────────────────────────────
-- Datos globales, sin userId — solo lectura pública
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exchange_rates_read" ON exchange_rates;
CREATE POLICY "exchange_rates_read" ON exchange_rates
  FOR SELECT USING (true);
-- INSERT/UPDATE solo vía service role (sin política = bloqueado para anon/authenticated)

-- ── grupos_gasto ─────────────────────────────────────────────────────────
ALTER TABLE grupos_gasto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grupos_gasto_member" ON grupos_gasto;
CREATE POLICY "grupos_gasto_member" ON grupos_gasto
  USING (
    "userId" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM miembros_grupo
      WHERE miembros_grupo."grupoId" = grupos_gasto.id
        AND miembros_grupo."userId" = auth.uid()::text
    )
  );

-- ── miembros_grupo ───────────────────────────────────────────────────────
ALTER TABLE miembros_grupo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "miembros_grupo_member" ON miembros_grupo;
CREATE POLICY "miembros_grupo_member" ON miembros_grupo
  USING (
    EXISTS (
      SELECT 1 FROM grupos_gasto
      WHERE grupos_gasto.id = miembros_grupo."grupoId"
        AND (
          grupos_gasto."userId" = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM miembros_grupo mg2
            WHERE mg2."grupoId" = grupos_gasto.id
              AND mg2."userId" = auth.uid()::text
          )
        )
    )
  );

-- ── gastos_grupo ─────────────────────────────────────────────────────────
ALTER TABLE gastos_grupo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gastos_grupo_member" ON gastos_grupo;
CREATE POLICY "gastos_grupo_member" ON gastos_grupo
  USING (
    EXISTS (
      SELECT 1 FROM grupos_gasto
      WHERE grupos_gasto.id = gastos_grupo."grupoId"
        AND (
          grupos_gasto."userId" = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM miembros_grupo
            WHERE miembros_grupo."grupoId" = grupos_gasto.id
              AND miembros_grupo."userId" = auth.uid()::text
          )
        )
    )
  );

-- ── divisiones_gasto ─────────────────────────────────────────────────────
ALTER TABLE divisiones_gasto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "divisiones_gasto_member" ON divisiones_gasto;
CREATE POLICY "divisiones_gasto_member" ON divisiones_gasto
  USING (
    EXISTS (
      SELECT 1 FROM gastos_grupo
      JOIN grupos_gasto ON grupos_gasto.id = gastos_grupo."grupoId"
      WHERE gastos_grupo.id = divisiones_gasto."gastoId"
        AND (
          grupos_gasto."userId" = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM miembros_grupo
            WHERE miembros_grupo."grupoId" = grupos_gasto.id
              AND miembros_grupo."userId" = auth.uid()::text
          )
        )
    )
  );

-- ── grupo_invitaciones ───────────────────────────────────────────────────
ALTER TABLE grupo_invitaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grupo_invitaciones_creator" ON grupo_invitaciones;
CREATE POLICY "grupo_invitaciones_creator" ON grupo_invitaciones
  USING (
    EXISTS (
      SELECT 1 FROM grupos_gasto
      WHERE grupos_gasto.id = grupo_invitaciones."grupoId"
        AND grupos_gasto."userId" = auth.uid()::text
    )
  );

-- ══════════════════════════════════════════════════════════════════════════
-- Verificación: listar todas las tablas con RLS habilitado
-- ══════════════════════════════════════════════════════════════════════════
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
