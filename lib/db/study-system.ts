import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  calcularProximoRepaso,
  priorityScore,
  suggestedActivity,
  type Mastery,
  type Stage,
} from "@/lib/study/spaced";

// ─────────────────────────────────────────────
// Tipos serializables para el cliente (sin Date crudos ni texto cifrado).
// ─────────────────────────────────────────────
export type SubjectDTO = {
  id: string;
  name: string;
  code: string;
  type: string;
  color: string | null;
  active: boolean;
  blockCount: number;
};

export type BlockDTO = {
  id: string;
  subjectId: string;
  subjectCode: string;
  code: string;
  unit: string | null;
  topic: string;
  subtopic: string | null;
  summary: string | null;
  source: string | null;
  importance: number;
  difficulty: number;
  masteryLevel: Mastery;
  reviewStage: Stage;
  reviewDuration: number;
  nextReviewDate: string | null;
  lastStudyDate: string | null;
  reviewCount: number;
  successCount: number;
  errorCount: number;
  status: string;
};

export type PlanItem = BlockDTO & {
  score: number;
  activity: string;
  overdueDays: number;
};

// ─────────────────────────────────────────────
// Materias
// ─────────────────────────────────────────────
export async function listSubjects(userId: string): Promise<SubjectDTO[]> {
  const [subjects, counts] = await Promise.all([
    prisma.studySubject.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studyBlock.groupBy({
      by: ["subjectId"],
      where: { userId, status: { not: "ARCHIVADO" } },
      _count: { _all: true },
    }),
  ]);
  const countMap = new Map(counts.map((c) => [c.subjectId, c._count._all]));
  return subjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
    color: s.color,
    active: s.active,
    blockCount: countMap.get(s.id) ?? 0,
  }));
}

export async function createSubject(
  userId: string,
  input: { name: string; code: string; type?: string; color?: string | null }
): Promise<SubjectDTO> {
  const s = await prisma.studySubject.create({
    data: {
      userId,
      name: input.name,
      code: input.code.toUpperCase(),
      type: input.type ?? "cuatrimestral",
      color: input.color ?? null,
    },
  });
  return { id: s.id, name: s.name, code: s.code, type: s.type, color: s.color, active: s.active, blockCount: 0 };
}

// ─────────────────────────────────────────────
// Bloques
// ─────────────────────────────────────────────
function toBlockDTO(b: {
  id: string; subjectId: string; code: string; unit: string | null; topic: string;
  subtopic: string | null; summary: string | null; source: string | null; importance: number;
  difficulty: number; masteryLevel: string; reviewStage: string; reviewDuration: number;
  nextReviewDate: Date | null; lastStudyDate: Date | null; reviewCount: number;
  successCount: number; errorCount: number; status: string;
}, subjectCode: string): BlockDTO {
  return {
    id: b.id,
    subjectId: b.subjectId,
    subjectCode,
    code: b.code,
    unit: b.unit,
    topic: b.topic,
    subtopic: b.subtopic,
    summary: decrypt(b.summary),
    source: b.source,
    importance: b.importance,
    difficulty: b.difficulty,
    masteryLevel: b.masteryLevel as Mastery,
    reviewStage: b.reviewStage as Stage,
    reviewDuration: b.reviewDuration,
    nextReviewDate: b.nextReviewDate ? b.nextReviewDate.toISOString() : null,
    lastStudyDate: b.lastStudyDate ? b.lastStudyDate.toISOString() : null,
    reviewCount: b.reviewCount,
    successCount: b.successCount,
    errorCount: b.errorCount,
    status: b.status,
  };
}

/** Siguiente número de bloque para una materia+parcial: cuenta bloques con ese prefijo. */
async function nextBlockCode(userId: string, subjectCode: string, parcial: number): Promise<string> {
  const prefix = `${subjectCode.toUpperCase()}-P${parcial}-`;
  const existing = await prisma.studyBlock.count({
    where: { userId, code: { startsWith: prefix } },
  });
  return `${prefix}${String(existing + 1).padStart(2, "0")}`;
}

export async function listBlocks(userId: string): Promise<BlockDTO[]> {
  const [blocks, subjects] = await Promise.all([
    prisma.studyBlock.findMany({
      where: { userId, status: { not: "ARCHIVADO" } },
      orderBy: [{ nextReviewDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));
  return blocks.map((b) => toBlockDTO(b, codeMap.get(b.subjectId) ?? "?"));
}

export async function createBlock(
  userId: string,
  input: {
    subjectId: string;
    parcial: number;
    topic: string;
    unit?: string | null;
    subtopic?: string | null;
    summary?: string | null;
    source?: string | null;
    importance?: number;
    difficulty?: number;
  }
): Promise<BlockDTO> {
  const subject = await prisma.studySubject.findFirst({
    where: { id: input.subjectId, userId },
    select: { id: true, code: true },
  });
  if (!subject) throw new Error("Materia no encontrada");

  const code = await nextBlockCode(userId, subject.code, input.parcial);
  const now = new Date();
  const b = await prisma.studyBlock.create({
    data: {
      userId,
      subjectId: subject.id,
      code,
      unit: input.unit ?? null,
      topic: input.topic,
      subtopic: input.subtopic ?? null,
      summary: encrypt(input.summary ?? null),
      source: input.source ?? null,
      importance: input.importance ?? 2,
      difficulty: input.difficulty ?? 2,
      masteryLevel: "ROJO",
      reviewStage: "D0",
      reviewDuration: 30,
      incorporationDate: now,
      nextReviewDate: now, // el D0 es hoy: entra al plan de una
    },
  });
  return toBlockDTO(b, subject.code);
}

// ─────────────────────────────────────────────
// Plan de hoy (Sección 36) — bloques con repaso vencido/para hoy, priorizados.
// budgetMin: minutos disponibles hoy; corta cuando se llena el día.
// ─────────────────────────────────────────────
export async function getTodayPlan(
  userId: string,
  budgetMin = 240,
  now = new Date()
): Promise<{ items: PlanItem[]; totalMin: number; budgetMin: number; overflow: PlanItem[] }> {
  const endOfToday = new Date(now);
  endOfToday.setUTCHours(23, 59, 59, 999);

  const [blocks, subjects] = await Promise.all([
    prisma.studyBlock.findMany({
      where: {
        userId,
        status: "ACTIVO",
        nextReviewDate: { lte: endOfToday },
      },
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));

  const scored = blocks
    .map((b) => {
      const dto = toBlockDTO(b, codeMap.get(b.subjectId) ?? "?");
      const overdueDays = b.nextReviewDate
        ? Math.max(0, Math.floor((now.getTime() - b.nextReviewDate.getTime()) / 86_400_000))
        : 0;
      return {
        ...dto,
        score: priorityScore(
          { masteryLevel: b.masteryLevel, nextReviewDate: b.nextReviewDate, importance: b.importance, errorCount: b.errorCount, incorporationDate: b.incorporationDate },
          now
        ),
        activity: suggestedActivity(b.reviewStage as Stage),
        overdueDays,
      };
    })
    .sort((a, b) => b.score - a.score);

  const items: PlanItem[] = [];
  const overflow: PlanItem[] = [];
  let totalMin = 0;
  for (const it of scored) {
    if (totalMin + it.reviewDuration <= budgetMin || items.length === 0) {
      items.push(it);
      totalMin += it.reviewDuration;
    } else {
      overflow.push(it);
    }
  }
  return { items, totalMin, budgetMin, overflow };
}

// ─────────────────────────────────────────────
// Cierre de sesión (Secciones 10, 11, 35) — obligatorio elegir estado.
// Recalcula la ÚNICA próxima fecha/etapa y registra la sesión.
// ─────────────────────────────────────────────
export async function closeSession(
  userId: string,
  input: {
    blockId: string;
    result: Mastery; // estado elegido al cerrar
    actualDuration?: number;
    explainedWithoutNotes?: boolean;
    solvedWithoutHelp?: boolean;
    usedNotes?: boolean;
    errorCategory?: string | null;
    errorDescription?: string | null;
    notes?: string | null;
  }
): Promise<BlockDTO> {
  const block = await prisma.studyBlock.findFirst({
    where: { id: input.blockId, userId },
  });
  if (!block) throw new Error("Bloque no encontrado");

  const now = new Date();
  const next = calcularProximoRepaso(
    {
      reviewStage: block.reviewStage as Stage,
      importance: block.importance,
      reviewDuration: block.reviewDuration,
      reviewCount: block.reviewCount,
    },
    input.result,
    now
  );

  const success = input.result === "VERDE" || input.result === "CONSOLIDADO";
  const failed = input.result === "ROJO";

  await prisma.studySession.create({
    data: {
      userId,
      blockId: block.id,
      sessionType: block.reviewStage === "D0" ? "ESTUDIO_INICIAL" : "RECUPERACION_ACTIVA",
      stage: block.reviewStage,
      masteryBefore: block.masteryLevel,
      masteryAfter: next.masteryLevel,
      plannedDuration: block.reviewDuration,
      actualDuration: input.actualDuration ?? null,
      explainedWithoutNotes: input.explainedWithoutNotes ?? null,
      solvedWithoutHelp: input.solvedWithoutHelp ?? null,
      usedNotes: input.usedNotes ?? null,
      errorCategory: input.errorCategory ?? null,
      errorDescription: encrypt(input.errorDescription ?? null),
      notes: encrypt(input.notes ?? null),
      nextDateCalculated: next.nextDate,
    },
  });

  const updated = await prisma.studyBlock.update({
    where: { id: block.id },
    data: {
      masteryLevel: next.masteryLevel,
      reviewStage: next.nextStage,
      reviewDuration: next.duration,
      nextReviewDate: next.nextDate,
      lastStudyDate: now,
      reviewCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      errorCount: failed ? { increment: 1 } : undefined,
    },
  });

  const subject = await prisma.studySubject.findFirst({
    where: { id: block.subjectId },
    select: { code: true },
  });
  return toBlockDTO(updated, subject?.code ?? "?");
}

export async function updateBlockStatus(userId: string, blockId: string, status: string): Promise<void> {
  await prisma.studyBlock.updateMany({ where: { id: blockId, userId }, data: { status } });
}

// ─────────────────────────────────────────────
// Estadísticas rápidas para el dashboard (Sección 32).
// ─────────────────────────────────────────────
export async function studyStats(userId: string, now = new Date()) {
  const blocks = await prisma.studyBlock.findMany({
    where: { userId, status: { not: "ARCHIVADO" } },
    select: { masteryLevel: true, nextReviewDate: true },
  });
  const endOfToday = new Date(now);
  endOfToday.setUTCHours(23, 59, 59, 999);
  const byLevel: Record<string, number> = { ROJO: 0, AMARILLO: 0, VERDE: 0, CONSOLIDADO: 0 };
  let dueToday = 0;
  let overdue = 0;
  for (const b of blocks) {
    byLevel[b.masteryLevel] = (byLevel[b.masteryLevel] ?? 0) + 1;
    if (b.nextReviewDate) {
      if (b.nextReviewDate < now && b.nextReviewDate.toDateString() !== now.toDateString()) overdue++;
      if (b.nextReviewDate <= endOfToday) dueToday++;
    }
  }
  return { total: blocks.length, byLevel, dueToday, overdue };
}
