-- Mi Círculo · fases 2, 3 y 4:
--   Referentes por obra (source_channels)
--   El Norte (circle_fronts)
--   La Cosecha (circle_harvests)
--   La Mudanza (circle_migrations, circle_inventory_items)
--   El puente (bridge_visits)
--
-- Migración aditiva: sólo crea tablas nuevas. Ver docs/MI_CIRCULO.md.

BEGIN;

-- ─── Referentes por obra ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "source_channels" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastError" TEXT,
  "lastFetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "source_channels_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "brief_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_channels_sourceId_feedUrl_key"
  ON "source_channels"("sourceId", "feedUrl");
CREATE INDEX IF NOT EXISTS "source_channels_status_lastFetchedAt_idx"
  ON "source_channels"("status", "lastFetchedAt");

-- ─── El Norte ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "circle_fronts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  -- label/detail van cifrados desde la app.
  "label" TEXT NOT NULL,
  "detail" TEXT,
  "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_fronts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_fronts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "circle_fronts_userId_isActive_position_idx"
  ON "circle_fronts"("userId", "isActive", "position");

-- ─── La Cosecha ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "circle_harvests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemTitle" TEXT NOT NULL,
  "itemUrl" TEXT NOT NULL,
  "sourceId" TEXT,
  "frontId" TEXT,
  "outcome" TEXT NOT NULL,
  "outcomeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_harvests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_harvests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "circle_harvests_userId_createdAt_idx"
  ON "circle_harvests"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "circle_harvests_sourceId_idx"
  ON "circle_harvests"("sourceId");

-- ─── La Mudanza ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "circle_migrations" (
  "userId" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'INVENTORY',
  "inventoryUploadedAt" TIMESTAMP(3),
  "coexistStartedAt" TIMESTAMP(3),
  "uninstalledAt" TIMESTAMP(3),
  "reinstalledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_migrations_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "circle_migrations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "circle_inventory_items" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "fullName" TEXT,
  "decision" TEXT NOT NULL DEFAULT 'PENDING',
  "resolvedType" TEXT,
  "resolvedId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "circle_inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_inventory_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "circle_inventory_items_userId_handle_key"
  ON "circle_inventory_items"("userId", "handle");
CREATE INDEX IF NOT EXISTS "circle_inventory_items_userId_decision_idx"
  ON "circle_inventory_items"("userId", "decision");

-- ─── El puente ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bridge_visits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT,
  "handle" TEXT NOT NULL,
  -- intention/finding van cifrados desde la app.
  "intention" TEXT NOT NULL,
  "finding" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "bridge_visits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bridge_visits_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bridge_visits_userId_openedAt_idx"
  ON "bridge_visits"("userId", "openedAt");

COMMIT;
