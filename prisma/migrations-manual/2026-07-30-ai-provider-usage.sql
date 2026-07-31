CREATE TABLE IF NOT EXISTS "ai_provider_usage" (
  "id" BIGSERIAL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "status_code" INTEGER,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_usd" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ai_provider_usage_provider_created_at_idx"
  ON "ai_provider_usage" ("provider", "created_at" DESC);
