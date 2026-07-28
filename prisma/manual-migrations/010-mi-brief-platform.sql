-- Mi Brief: fuentes persistentes, contenido social normalizado, Radar y progreso.
-- Migración completamente aditiva: conserva NewsletterEdition.articles y todas
-- las preferencias/ediciones existentes.

BEGIN;

ALTER TABLE "newsletter_configs"
  ADD COLUMN IF NOT EXISTS "discoveryLevel" TEXT NOT NULL DEFAULT 'BALANCED',
  ADD COLUMN IF NOT EXISTS "briefLength" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "localSourcesMigratedAt" TIMESTAMP(3);

ALTER TABLE "newsletter_editions"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "brief_sources" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'ACCOUNT',
  "category" TEXT NOT NULL DEFAULT 'REFERENCE',
  "normalizedKey" TEXT NOT NULL,
  "priority" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brief_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brief_sources_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "brief_sources_userId_normalizedKey_key"
  ON "brief_sources"("userId", "normalizedKey");
CREATE INDEX IF NOT EXISTS "brief_sources_userId_isActive_priority_idx"
  ON "brief_sources"("userId", "isActive", "priority");

CREATE TABLE IF NOT EXISTS "social_accounts" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "profileUrl" TEXT NOT NULL,
  "externalId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_accounts_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "brief_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_sourceId_platform_handle_key"
  ON "social_accounts"("sourceId", "platform", "handle");
CREATE INDEX IF NOT EXISTS "social_accounts_platform_handle_idx"
  ON "social_accounts"("platform", "handle");

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "publishedAt" TIMESTAMP(3),
  "metrics" JSONB,
  "topicSignals" JSONB,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "social_posts_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_accountId_externalId_key"
  ON "social_posts"("accountId", "externalId");
CREATE INDEX IF NOT EXISTS "social_posts_accountId_publishedAt_idx"
  ON "social_posts"("accountId", "publishedAt");

CREATE TABLE IF NOT EXISTS "brief_items" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "contentKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "socialPostId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "topic" TEXT,
  "publishedAt" TIMESTAMP(3),
  "rank" INTEGER NOT NULL,
  "section" TEXT NOT NULL,
  "inclusionReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brief_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brief_items_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "newsletter_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brief_items_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "brief_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "brief_items_socialPostId_fkey"
    FOREIGN KEY ("socialPostId") REFERENCES "social_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "brief_items_editionId_contentKey_key"
  ON "brief_items"("editionId", "contentKey");
CREATE INDEX IF NOT EXISTS "brief_items_editionId_section_rank_idx"
  ON "brief_items"("editionId", "section", "rank");
CREATE INDEX IF NOT EXISTS "brief_items_sourceId_idx"
  ON "brief_items"("sourceId");

CREATE TABLE IF NOT EXISTS "discovery_candidates" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "candidateType" TEXT NOT NULL DEFAULT 'ACCOUNT',
  "sourceName" TEXT NOT NULL,
  "platform" TEXT,
  "handle" TEXT,
  "profileUrl" TEXT NOT NULL,
  "topic" TEXT,
  "score" DOUBLE PRECISION,
  "explanation" TEXT NOT NULL,
  "signals" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discovery_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discovery_candidates_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "discovery_candidates_userId_date_profileUrl_key"
  ON "discovery_candidates"("userId", "date", "profileUrl");
CREATE INDEX IF NOT EXISTS "discovery_candidates_userId_date_status_idx"
  ON "discovery_candidates"("userId", "date", "status");

CREATE TABLE IF NOT EXISTS "brief_feedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brief_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brief_feedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "brief_feedback_userId_targetType_targetId_action_key"
  ON "brief_feedback"("userId", "targetType", "targetId", "action");
CREATE INDEX IF NOT EXISTS "brief_feedback_userId_createdAt_idx"
  ON "brief_feedback"("userId", "createdAt");

COMMIT;
