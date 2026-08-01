-- Organización · "Algún día"
--
-- Lo que no descartás pero tampoco agendás. Sin este estanque, todo cae en la
-- misma pila y la lista principal se vuelve impasable ("todo parece urgente").
--
-- Aditiva y con default: no reescribe la tabla ni toca las filas existentes.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "someday" BOOLEAN NOT NULL DEFAULT false;

-- Las vistas activas filtran por someday = false, así que conviene el índice
-- parcial sobre lo que realmente se consulta.
CREATE INDEX IF NOT EXISTS "tasks_user_someday_idx" ON "tasks" ("userId", "someday") WHERE NOT "someday";
