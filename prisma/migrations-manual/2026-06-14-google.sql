-- Aditivo: conexión a Google (Calendar + Tasks).
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "googleEmail" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "googleConnectedAt" TIMESTAMP(3);
