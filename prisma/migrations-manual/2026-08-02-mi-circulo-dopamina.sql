-- Mi Círculo · la capa de recompensa.
--
-- La premisa: la sección SÍ tiene que generar dopamina, pero disparada por
-- conversión y cierre, nunca por consumo. Ver docs/MI_CIRCULO.md.
--
-- Lo único que la capa nueva necesita de la base es poder guardar QUÉ salió de
-- una conversación declarada. Todo lo demás (la línea de base del inventario,
-- la cosecha histórica, la dosis del andamio) se deriva de datos que ya se
-- están guardando.
--
-- Migración aditiva: una columna opcional, sin backfill.

BEGIN;

ALTER TABLE "circle_touches" ADD COLUMN IF NOT EXISTS "note" TEXT;

COMMIT;
