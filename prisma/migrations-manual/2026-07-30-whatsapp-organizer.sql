CREATE TABLE IF NOT EXISTS whatsapp_organizer_settings (
  user_id TEXT PRIMARY KEY,
  brief_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  brief_hour INTEGER NOT NULL DEFAULT 8,
  work_start INTEGER NOT NULL DEFAULT 8,
  work_end INTEGER NOT NULL DEFAULT 20,
  focus_minutes INTEGER NOT NULL DEFAULT 50,
  buffer_minutes INTEGER NOT NULL DEFAULT 10,
  last_brief_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wos_brief_idx
  ON whatsapp_organizer_settings (brief_enabled, brief_hour);
