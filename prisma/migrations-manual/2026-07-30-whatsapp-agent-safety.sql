CREATE TABLE IF NOT EXISTS "whatsapp_pending_actions" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "wpa_user_expires_idx"
  ON "whatsapp_pending_actions" ("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "whatsapp_agent_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "intent" TEXT,
  "action_types" TEXT,
  "provider" TEXT,
  "latency_ms" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "error_code" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "wae_created_event_idx"
  ON "whatsapp_agent_events" ("created_at", "event");
CREATE INDEX IF NOT EXISTS "wae_user_created_idx"
  ON "whatsapp_agent_events" ("user_id", "created_at");
