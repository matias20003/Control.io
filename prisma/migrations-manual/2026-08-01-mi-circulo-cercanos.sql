-- Mi Círculo · Cercanos: la mitad "gente" de la sección.
-- Migración aditiva: crea dos tablas nuevas y no toca nada existente.
-- Ver docs/MI_CIRCULO.md.

BEGIN;

CREATE TABLE IF NOT EXISTS "circle_contacts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  -- name/phone/note van cifrados (AES-256-GCM, prefijo "enc:") desde la app.
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "note" TEXT,
  "tier" TEXT NOT NULL DEFAULT 'CLOSE',
  "cadenceDays" INTEGER NOT NULL DEFAULT 28,
  "lastContactAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_contacts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "circle_contacts_userId_isActive_idx"
  ON "circle_contacts"("userId", "isActive");

CREATE TABLE IF NOT EXISTS "circle_touches" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "happenedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'APP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_touches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_touches_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "circle_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "circle_touches_contactId_happenedAt_idx"
  ON "circle_touches"("contactId", "happenedAt");
CREATE INDEX IF NOT EXISTS "circle_touches_userId_happenedAt_idx"
  ON "circle_touches"("userId", "happenedAt");

COMMIT;
