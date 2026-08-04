-- Cierra el acceso público a las tablas que quedaron sin Row Level Security.
--
-- El problema: Supabase expone TODA tabla de `public` por su API REST, y la
-- anon key viaja en el bundle del frontend — es pública por diseño. Una tabla
-- sin RLS es, literalmente, una tabla que cualquiera puede leer, editar y
-- borrar entera con un curl. Al 2026-08-04 había 44 así, entre ellas los
-- contactos de Mi Círculo, las sesiones de dispositivo, los tokens de sync de
-- Google Calendar, todo el sistema de estudio y los ajustes de WhatsApp.
--
-- La solución: habilitar RLS y NO escribir políticas. Sin políticas, la API
-- REST no devuelve ni acepta nada. Eso alcanza porque la app no lee datos por
-- esa vía: usa Prisma contra Postgres (rol `postgres`, con BYPASSRLS) y el
-- cliente de Supabase sólo para auth y Storage. Verificado antes de aplicar:
-- no hay un solo `supabase.from("<tabla>")` en el código.
--
-- Se recorren todas las tablas en vez de listarlas: una lista escrita a mano
-- envejece con la próxima migración, y la tabla que se olvide queda abierta
-- sin que nadie se entere. El default correcto acá es cerrado.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS habilitado en %', t.relname;
  END LOOP;
END $$;
