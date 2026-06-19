-- Aditivo: tabla de tareas/pendientes (asistente de vida). RLS encendido como
-- el resto; el runtime accede vía Prisma (rol postgres con BYPASSRLS).
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "done" BOOLEAN NOT NULL DEFAULT false,
  "doneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "tasks_userId_done_dueDate_idx" ON "tasks"("userId", "done", "dueDate");
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
