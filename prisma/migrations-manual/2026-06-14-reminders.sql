-- Aditivo: recordatorios con hora. RLS encendido; runtime vía Prisma (BYPASSRLS).
CREATE TABLE IF NOT EXISTS "reminders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "remindAt" TIMESTAMP(3) NOT NULL,
  "sent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "reminders_sent_remindAt_idx" ON "reminders"("sent", "remindAt");
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;
