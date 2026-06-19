-- Aditivo: suscripción / monetización (plan + acceso premium + id de MercadoPago).
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "premiumUntil" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;
