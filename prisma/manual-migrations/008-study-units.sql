-- Migración manual: JERARQUÍA de estudio (Materia → Unidad/Capítulo → Tema) y
-- ESTUDIO INICIAL REPARTIDO (un tema grande se estudia en varias sesiones antes
-- de entrar al repaso espaciado). Aplicar UNA SOLA VEZ contra producción
-- (Supabase → SQL editor). Todo es idempotente (IF NOT EXISTS).

-- 1) Unidades/Capítulos: nivel de agrupación dentro de cada materia.
CREATE TABLE IF NOT EXISTS "study_units" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "study_units_user_subject_idx"
  ON "study_units"("user_id", "subject_id");

ALTER TABLE "study_units"
  DROP CONSTRAINT IF EXISTS "study_units_subject_fkey";
ALTER TABLE "study_units"
  ADD CONSTRAINT "study_units_subject_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "study_subjects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) StudyBlock: a qué unidad pertenece + estudio inicial repartido.
--    initial_sessions = cuántas sesiones de estudio inicial tiene el tema.
--    initial_done     = cuántas de esas ya se hicieron (al completarlas entra a D+1).
ALTER TABLE "study_blocks" ADD COLUMN IF NOT EXISTS "unit_id" TEXT;
ALTER TABLE "study_blocks" ADD COLUMN IF NOT EXISTS "initial_sessions" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "study_blocks" ADD COLUMN IF NOT EXISTS "initial_done" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "study_blocks_unit_idx" ON "study_blocks"("unit_id");

ALTER TABLE "study_blocks"
  DROP CONSTRAINT IF EXISTS "study_blocks_unit_fkey";
ALTER TABLE "study_blocks"
  ADD CONSTRAINT "study_blocks_unit_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "study_units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) StudySubject: cómo llama esta materia a su nivel de agrupación
--    ("Unidad" para Análisis, "Capítulo" para Física, etc.).
ALTER TABLE "study_subjects" ADD COLUMN IF NOT EXISTS "group_label" TEXT NOT NULL DEFAULT 'Unidad';
