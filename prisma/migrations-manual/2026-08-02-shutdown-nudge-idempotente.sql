-- Empujón de cierre del día · arreglo del envío repetido
--
-- El cron de recordatorios corre CADA MINUTO. La primera versión sólo miraba
-- `hour === 21`, así que durante toda la hora 21 la condición se cumplía en cada
-- corrida y mandaba un mensaje por minuto, a los 11 perfiles con WhatsApp.
--
-- Dos arreglos, los dos acá:
--  1) last_shutdown_date permite un claim atómico por día, igual que el brief
--     de la mañana: se marca ANTES de llamar a WhatsApp, así ni siquiera dos
--     corridas simultáneas pueden mandar dos veces.
--  2) shutdown_enabled arranca en FALSE: el aviso pasa a ser opt-in explícito.
--     Nadie más recibe nada sin haberlo pedido.
ALTER TABLE "whatsapp_organizer_settings"
  ADD COLUMN IF NOT EXISTS "shutdown_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "shutdown_hour" INTEGER NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS "last_shutdown_date" TEXT;
