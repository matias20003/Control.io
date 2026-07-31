CREATE TABLE IF NOT EXISTS "whatsapp_agent_rules" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "match_value" TEXT NOT NULL,
  "result_value" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "war_user_enabled_idx"
  ON "whatsapp_agent_rules" ("user_id", "enabled", "id");

CREATE TABLE IF NOT EXISTS "whatsapp_insight_deliveries" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "insight_key" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "insight_key")
);

CREATE INDEX IF NOT EXISTS "wid_created_idx"
  ON "whatsapp_insight_deliveries" ("created_at");
