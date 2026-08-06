-- El sistema académico argentino, y el reparto de material para un examen.
--
-- Dos cosas que ninguna app internacional modela, verificado buscando en las
-- tiendas: "correlativas" no devuelve un solo resultado relevante en Google
-- Play Argentina, y en el App Store devuelve dos apps indie locales. En el
-- modelo de afuera una materia se aprueba y se termina; acá una cursada
-- aprobada con final pendiente queda colgada meses o años, y es la forma número
-- uno de perder una materia de vista.

-- ── Estado real de una materia ──
ALTER TABLE public.study_subjects
  ADD COLUMN IF NOT EXISTS "status"        TEXT NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS "cursada_grade" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "final_grade"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "promoted"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "cursada_at"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "final_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "plan_year"     INTEGER;

CREATE INDEX IF NOT EXISTS "study_subjects_user_id_status_idx"
  ON public.study_subjects ("user_id", "status");

-- ── Correlativas ──
-- kind distingue los tres requisitos que la facultad trata distinto:
--   CURSAR_NECESITA_CURSADA · CURSAR_NECESITA_APROBADA · RENDIR_NECESITA_APROBADA
CREATE TABLE IF NOT EXISTS public.subject_prerequisites (
  "id"          TEXT PRIMARY KEY,
  "user_id"     TEXT NOT NULL,
  "subject_id"  TEXT NOT NULL REFERENCES public.study_subjects("id") ON DELETE CASCADE,
  "required_id" TEXT NOT NULL REFERENCES public.study_subjects("id") ON DELETE CASCADE,
  "kind"        TEXT NOT NULL DEFAULT 'CURSAR_NECESITA_CURSADA',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "subject_prerequisites_subject_required_kind_key"
  ON public.subject_prerequisites ("subject_id", "required_id", "kind");
CREATE INDEX IF NOT EXISTS "subject_prerequisites_user_id_idx"
  ON public.subject_prerequisites ("user_id");

-- ── El ciclo de exámenes: parcial, recuperatorio, final ──
-- Un recuperatorio no es un parcial nuevo: es la segunda chance del mismo, y
-- por eso apunta al que recupera.
ALTER TABLE public.study_exams
  ADD COLUMN IF NOT EXISTS "kind"        TEXT NOT NULL DEFAULT 'PARCIAL',
  ADD COLUMN IF NOT EXISTS "recupera_id" TEXT,
  ADD COLUMN IF NOT EXISTS "grade"       DOUBLE PRECISION;

-- ── El repartidor de material ──
-- minutes_per_day guarda cuánto puede estudiar cada día de la semana
-- (índice 0 = domingo). El reparto es por tiempo disponible, no por cantidad
-- de temas: repartir "seis unidades en tres días" ignora que una unidad puede
-- llevar el triple que otra.
CREATE TABLE IF NOT EXISTS public.study_plans (
  "id"             TEXT PRIMARY KEY,
  "user_id"        TEXT NOT NULL,
  "exam_id"        TEXT NOT NULL UNIQUE REFERENCES public.study_exams("id") ON DELETE CASCADE,
  "minutes_per_day" INTEGER[] NOT NULL,
  "review_days"    INTEGER NOT NULL DEFAULT 2,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rebalanced_at"  TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "study_plans_user_id_idx" ON public.study_plans ("user_id");

-- scheduled_for lo pone el repartidor y lo mueve el rebalanceo; done lo pone la
-- persona. Que sean campos distintos es lo que permite reacomodar el plan sin
-- perder lo que ya se estudió.
CREATE TABLE IF NOT EXISTS public.study_plan_items (
  "id"            TEXT PRIMARY KEY,
  "plan_id"       TEXT NOT NULL REFERENCES public.study_plans("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "minutes"       INTEGER NOT NULL DEFAULT 45,
  "weight"        INTEGER NOT NULL DEFAULT 2,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "scheduled_for" DATE,
  "done"          BOOLEAN NOT NULL DEFAULT FALSE,
  "done_at"       TIMESTAMP(3),
  "is_review"     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS "study_plan_items_plan_id_scheduled_for_idx"
  ON public.study_plan_items ("plan_id", "scheduled_for");

-- Las tablas nuevas nacen cerradas, como todas: la app entra por Prisma, no por
-- la API REST de Supabase.
ALTER TABLE public.subject_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_items      ENABLE ROW LEVEL SECURITY;
