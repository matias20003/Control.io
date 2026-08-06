-- Dos salidas que faltaban.
--
-- tasks.droppedAt — junto con status = 'DROPPED', da el tercer camino para una
-- tarea: además de hacerla o posponerla, poder decir "esto ya no importa". Hoy
-- agregar una tarea cuesta dos segundos y sacarla sin sentirse en falta no
-- tiene forma, así que todo lo que dejó de importar se pospone para siempre y
-- engorda una lista que termina siendo la razón por la que se deja de abrir la
-- app. Se guarda la fecha en vez de borrar la fila para poder deshacer.
--
-- habits.anchor — el evento después del cual toca el hábito ("después de
-- desayunar"), en vez de una hora del reloj. Es la diferencia entre el
-- disparador que la evidencia experimental encontró efectivo para formar
-- automatismo y el recordatorio por hora, que sostiene la repetición pero no
-- el hábito.

ALTER TABLE public.tasks  ADD COLUMN IF NOT EXISTS "droppedAt" TIMESTAMP(3);
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS "anchor"    TEXT;

-- Buscar lo descartado por fecha (para deshacer y para el resumen) sin barrer
-- la tabla entera: sólo se indexan las filas que efectivamente se descartaron.
CREATE INDEX IF NOT EXISTS "tasks_userId_droppedAt_idx"
  ON public.tasks ("userId", "droppedAt")
  WHERE "droppedAt" IS NOT NULL;
