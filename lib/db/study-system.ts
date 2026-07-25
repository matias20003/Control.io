import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  calcularProximoRepaso,
  priorityScore,
  suggestedActivity,
  examBoost,
  subjectTypeBoost,
  DEFAULT_AVAILABILITY,
  nextInitialDate,
  type Mastery,
  type Stage,
  type NextReview,
} from "@/lib/study/spaced";
import { endOfTodayArg, startOfTodayArg, nowArgParts } from "@/lib/timezone";

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
  groupLabel: string; // cómo llama a su agrupación: "Unidad" | "Capítulo" | …
  blockCount: number;
};

export type UnitDTO = {
  id: string;
  subjectId: string;
  name: string;
  order: number;
};

export type BlockDTO = {
  id: string;
  subjectId: string;
  subjectCode: string;
  unitId: string | null;
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
  initialSessions: number; // sesiones de estudio inicial del tema
  initialDone: number;     // cuántas ya se hicieron (al completarlas entra al repaso)
  nextReviewDate: string | null;
  lastStudyDate: string | null;
  reviewCount: number;
  successCount: number;
  errorCount: number;
  status: string;
  lastError: string | null; // error a reforzar (del último cierre con error)
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
    groupLabel: s.groupLabel,
    blockCount: countMap.get(s.id) ?? 0,
  }));
}

// ─────────────────────────────────────────────
// Unidades / Capítulos (agrupación dentro de la materia)
// ─────────────────────────────────────────────
export async function listUnits(userId: string, subjectId?: string): Promise<UnitDTO[]> {
  const units = await prisma.studyUnit.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return units.map((u) => ({ id: u.id, subjectId: u.subjectId, name: u.name, order: u.order }));
}

export async function createUnit(
  userId: string,
  input: { subjectId: string; name: string; order?: number }
): Promise<UnitDTO> {
  const subject = await prisma.studySubject.findFirst({ where: { id: input.subjectId, userId }, select: { id: true } });
  if (!subject) throw new Error("Materia no encontrada");
  const order = input.order ?? (await prisma.studyUnit.count({ where: { userId, subjectId: input.subjectId } }));
  const u = await prisma.studyUnit.create({
    data: { userId, subjectId: input.subjectId, name: input.name.trim(), order },
  });
  return { id: u.id, subjectId: u.subjectId, name: u.name, order: u.order };
}

export async function renameUnit(userId: string, unitId: string, name: string): Promise<void> {
  await prisma.studyUnit.updateMany({ where: { id: unitId, userId }, data: { name: name.trim() } });
}

/** Elimina la unidad; sus temas quedan sin unidad (unitId → null), no se borran. */
export async function deleteUnit(userId: string, unitId: string): Promise<void> {
  await prisma.studyUnit.deleteMany({ where: { id: unitId, userId } });
}

export async function setSubjectGroupLabel(userId: string, subjectId: string, label: string): Promise<void> {
  await prisma.studySubject.updateMany({ where: { id: subjectId, userId }, data: { groupLabel: label.trim() || "Unidad" } });
}

/** "Empezar limpio": archiva todos los bloques (conserva historial) y opcionalmente sus unidades. */
export async function archiveAllBlocks(userId: string, subjectId?: string): Promise<number> {
  const res = await prisma.studyBlock.updateMany({
    where: { userId, status: { not: "ARCHIVADO" }, ...(subjectId ? { subjectId } : {}) },
    data: { status: "ARCHIVADO" },
  });
  return res.count;
}

export async function createSubject(
  userId: string,
  input: { name: string; code: string; type?: string; color?: string | null; groupLabel?: string }
): Promise<SubjectDTO> {
  const s = await prisma.studySubject.create({
    data: {
      userId,
      name: input.name,
      code: input.code.toUpperCase(),
      type: input.type ?? "cuatrimestral",
      color: input.color ?? null,
      groupLabel: input.groupLabel?.trim() || "Unidad",
    },
  });
  return { id: s.id, name: s.name, code: s.code, type: s.type, color: s.color, active: s.active, groupLabel: s.groupLabel, blockCount: 0 };
}

// ─────────────────────────────────────────────
// Bloques
// ─────────────────────────────────────────────
function toBlockDTO(b: {
  id: string; subjectId: string; unitId: string | null; code: string; unit: string | null; topic: string;
  subtopic: string | null; summary: string | null; source: string | null; importance: number;
  difficulty: number; masteryLevel: string; reviewStage: string; reviewDuration: number;
  initialSessions: number; initialDone: number;
  nextReviewDate: Date | null; lastStudyDate: Date | null; reviewCount: number;
  successCount: number; errorCount: number; status: string;
}, subjectCode: string): BlockDTO {
  return {
    id: b.id,
    subjectId: b.subjectId,
    subjectCode,
    unitId: b.unitId,
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
    initialSessions: b.initialSessions,
    initialDone: b.initialDone,
    nextReviewDate: b.nextReviewDate ? b.nextReviewDate.toISOString() : null,
    lastStudyDate: b.lastStudyDate ? b.lastStudyDate.toISOString() : null,
    reviewCount: b.reviewCount,
    successCount: b.successCount,
    errorCount: b.errorCount,
    status: b.status,
    lastError: null,
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
  const [blocks, subjects, errorSessions] = await Promise.all([
    prisma.studyBlock.findMany({
      where: { userId, status: { not: "ARCHIVADO" } },
      orderBy: [{ nextReviewDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
    prisma.studySession.findMany({
      where: { userId, errorCategory: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { blockId: true, errorCategory: true, errorDescription: true },
    }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));
  // último error por bloque (errorSessions viene ordenado desc, nos quedamos con el primero)
  const lastErrByBlock = new Map<string, string>();
  for (const s of errorSessions) {
    if (lastErrByBlock.has(s.blockId)) continue;
    const desc = decrypt(s.errorDescription);
    lastErrByBlock.set(s.blockId, desc ? `${s.errorCategory}: ${desc}` : (s.errorCategory ?? ""));
  }
  return blocks.map((b) => {
    const dto = toBlockDTO(b, codeMap.get(b.subjectId) ?? "?");
    dto.lastError = lastErrByBlock.get(b.id) ?? null;
    return dto;
  });
}

export async function createBlock(
  userId: string,
  input: {
    subjectId: string;
    parcial: number;
    topic: string;
    unit?: string | null;
    unitId?: string | null;
    subtopic?: string | null;
    summary?: string | null;
    source?: string | null;
    importance?: number;
    difficulty?: number;
    initialSessions?: number; // en cuántas sesiones se estudia por primera vez
  }
): Promise<BlockDTO> {
  const subject = await prisma.studySubject.findFirst({
    where: { id: input.subjectId, userId },
    select: { id: true, code: true },
  });
  if (!subject) throw new Error("Materia no encontrada");

  const code = await nextBlockCode(userId, subject.code, input.parcial);
  const now = new Date();
  const initialSessions = Math.max(1, Math.min(6, Math.round(input.initialSessions ?? 1)));
  const b = await prisma.studyBlock.create({
    data: {
      userId,
      subjectId: subject.id,
      unitId: input.unitId ?? null,
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
      initialSessions,
      initialDone: 0,
      incorporationDate: now,
      nextReviewDate: now, // el D0 es hoy: entra al plan de una
    },
  });
  await balanceUpcoming(userId).catch(() => {});
  return toBlockDTO(b, subject.code);
}

/** Mapa subjectId → días hasta su examen más cercano (no vencido, no hecho). */
async function upcomingExamDaysBySubject(userId: string, now: Date): Promise<Map<string, number>> {
  const exams = await prisma.studyExam.findMany({
    where: { userId, done: false, examDate: { gte: now } },
    select: { subjectId: true, examDate: true },
  });
  const map = new Map<string, number>();
  for (const e of exams) {
    const days = Math.ceil((e.examDate.getTime() - now.getTime()) / 86_400_000);
    const prev = map.get(e.subjectId);
    if (prev == null || days < prev) map.set(e.subjectId, days);
  }
  return map;
}

/**
 * Crea varios bloques de una vez y reparte su PRIMER estudio (D0) en los próximos
 * días disponibles sin sobrecargar ninguno (respeta la capacidad diaria y saltea
 * descansos). Devuelve los bloques creados con su fecha asignada.
 */
export async function createBlocksDistributed(
  userId: string,
  subjectId: string,
  parcial: number,
  proposals: Array<{
    topic: string; unit?: string | null; unitId?: string | null; summary?: string | null; prerequisites?: string | null;
    source?: string | null; difficulty?: number; importance?: number; estMinutes?: number; initialSessions?: number;
  }>,
  now = new Date()
): Promise<BlockDTO[]> {
  const subject = await prisma.studySubject.findFirst({ where: { id: subjectId, userId }, select: { id: true, code: true } });
  if (!subject) throw new Error("Materia no encontrada");
  if (proposals.length === 0) return [];

  const availability = await getAvailabilityMap(userId);
  const startOfToday = startOfTodayArg();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  // carga ya comprometida por día (bloques activos con repaso futuro)
  const future = await prisma.studyBlock.findMany({
    where: { userId, status: "ACTIVO", nextReviewDate: { gte: startOfToday } },
    select: { nextReviewDate: true, reviewDuration: true },
  });
  const usedByDay = new Map<string, number>();
  for (const f of future) if (f.nextReviewDate) usedByDay.set(dayKey(f.nextReviewDate), (usedByDay.get(dayKey(f.nextReviewDate)) ?? 0) + f.reviewDuration);

  // día candidato para una duración dada (primer día con capacidad desde hoy)
  const pickDay = (dur: number): Date => {
    let cursor = new Date(startOfToday.getTime() + 15 * 3600 * 1000); // ~12:00 ARG
    for (let i = 0; i < 90; i++) {
      const cap = availability[cursor.getDay()] ?? 0;
      const used = usedByDay.get(dayKey(cursor)) ?? 0;
      if (cap > 0 && used + dur <= cap) return cursor;
      cursor = new Date(cursor.getTime() + 86_400_000);
      cursor.setHours(12, 0, 0, 0);
    }
    // fallback: primer día con cualquier capacidad, o hoy
    let c = new Date(startOfToday.getTime() + 15 * 3600 * 1000);
    for (let i = 0; i < 14; i++) {
      if ((availability[c.getDay()] ?? 0) > 0) return c;
      c = new Date(c.getTime() + 86_400_000); c.setHours(12, 0, 0, 0);
    }
    return new Date(startOfToday.getTime() + 15 * 3600 * 1000);
  };

  const prefix = `${subject.code.toUpperCase()}-P${parcial}-`;
  let n = await prisma.studyBlock.count({ where: { userId, code: { startsWith: prefix } } });

  const created: BlockDTO[] = [];
  for (const p of proposals) {
    const dur = Math.max(15, Math.min(45, p.estMinutes ?? 30));
    const day = pickDay(dur);
    usedByDay.set(dayKey(day), (usedByDay.get(dayKey(day)) ?? 0) + dur);
    n += 1;
    const code = `${prefix}${String(n).padStart(2, "0")}`;
    const source = p.prerequisites ? `${p.source ?? ""}${p.source ? " · " : ""}Prereq: ${p.prerequisites}`.slice(0, 200) : p.source ?? null;
    const b = await prisma.studyBlock.create({
      data: {
        userId, subjectId: subject.id, code,
        unitId: p.unitId ?? null,
        unit: p.unit ?? null, topic: p.topic,
        summary: encrypt(p.summary ?? null), source,
        importance: p.importance ?? 2, difficulty: p.difficulty ?? 2,
        initialSessions: Math.max(1, Math.min(6, Math.round(p.initialSessions ?? 1))),
        masteryLevel: "ROJO", reviewStage: "D0", reviewDuration: dur,
        incorporationDate: now, nextReviewDate: day,
      },
    });
    created.push(toBlockDTO(b, subject.code));
  }
  // Rebalanceo global: reacomoda los repasos futuros sin sobrecargar días.
  await balanceUpcoming(userId).catch(() => {});
  return created;
}

// ─────────────────────────────────────────────
// Plan de hoy (Sección 36) — bloques con repaso vencido/para hoy, priorizados
// según dominio + atraso + importancia + errores + examen cercano.
// El presupuesto de minutos sale de tu disponibilidad real del día.
// ─────────────────────────────────────────────
export async function getTodayPlan(
  userId: string,
  budgetMin?: number,
  now = new Date()
): Promise<{ items: PlanItem[]; totalMin: number; budgetMin: number; overflow: PlanItem[]; isRestDay: boolean }> {
  const endOfToday = endOfTodayArg();
  const weekday = nowArgParts().weekday;

  const availability = await getAvailabilityMap(userId);
  const todayMinutes = budgetMin ?? availability[weekday] ?? 0;
  const rest = todayMinutes <= 0;

  const [blocks, subjects, examDays, errorSessions] = await Promise.all([
    prisma.studyBlock.findMany({
      where: { userId, status: "ACTIVO", nextReviewDate: { lte: endOfToday } },
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true, type: true } }),
    upcomingExamDaysBySubject(userId, now),
    prisma.studySession.findMany({
      where: { userId, errorCategory: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { blockId: true, errorCategory: true, errorDescription: true },
    }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));
  const typeMap = new Map(subjects.map((s) => [s.id, s.type]));
  const lastErrByBlock = new Map<string, string>();
  for (const s of errorSessions) {
    if (lastErrByBlock.has(s.blockId)) continue;
    const desc = decrypt(s.errorDescription);
    lastErrByBlock.set(s.blockId, desc ? `${s.errorCategory}: ${desc}` : (s.errorCategory ?? ""));
  }

  const scored = blocks
    .map((b) => {
      const dto = toBlockDTO(b, codeMap.get(b.subjectId) ?? "?");
      dto.lastError = lastErrByBlock.get(b.id) ?? null;
      const overdueDays = b.nextReviewDate
        ? Math.max(0, Math.floor((now.getTime() - b.nextReviewDate.getTime()) / 86_400_000))
        : 0;
      const base = priorityScore(
        { masteryLevel: b.masteryLevel, nextReviewDate: b.nextReviewDate, importance: b.importance, errorCount: b.errorCount, incorporationDate: b.incorporationDate },
        now
      );
      const boost = examBoost(examDays.get(b.subjectId) ?? null) + subjectTypeBoost(typeMap.get(b.subjectId));
      return { ...dto, score: base + boost, activity: suggestedActivity(b.reviewStage as Stage), overdueDays };
    })
    .sort((a, b) => b.score - a.score);

  // En día de descanso no cargamos nada nuevo; todo queda como overflow.
  const items: PlanItem[] = [];
  const overflow: PlanItem[] = [];
  let totalMin = 0;
  for (const it of scored) {
    const fits = totalMin + it.reviewDuration <= todayMinutes;
    if (!rest && (fits || items.length === 0)) {
      items.push(it);
      totalMin += it.reviewDuration;
    } else {
      overflow.push(it);
    }
  }
  return { items, totalMin, budgetMin: todayMinutes, overflow, isRestDay: rest };
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

  // Estudio inicial repartido: mientras queden sesiones iniciales del tema, NO
  // entra al repaso espaciado — se agenda la próxima sesión inicial en ~2 días.
  // Recién al completar la última sesión inicial arranca el ciclo D+1, D+3, …
  const totalInitial = Math.max(1, block.initialSessions);
  const willBeDone = Math.min(block.initialDone + 1, totalInitial);
  const stillInitial = willBeDone < totalInitial;

  const next: NextReview = stillInitial
    ? {
        nextDate: nextInitialDate(now),
        nextStage: "D0",
        duration: 30,
        masteryLevel: input.result as Mastery, // refleja cómo viene, sin consolidar
      }
    : calcularProximoRepaso(
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
      initialDone: willBeDone,
      reviewCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      errorCount: failed ? { increment: 1 } : undefined,
    },
  });

  const subject = await prisma.studySubject.findFirst({
    where: { id: block.subjectId },
    select: { code: true },
  });
  // Tras recalcular la próxima fecha, rebalanceamos para no sobrecargar días.
  await balanceUpcoming(userId).catch(() => {});
  return toBlockDTO(updated, subject?.code ?? "?");
}

export async function updateBlockStatus(userId: string, blockId: string, status: string): Promise<void> {
  await prisma.studyBlock.updateMany({ where: { id: blockId, userId }, data: { status } });
}

/** Edita los datos de un bloque (tema): título, subtema, resumen, importancia y dificultad. */
export async function updateBlock(
  userId: string,
  blockId: string,
  fields: { topic?: string; subtopic?: string | null; summary?: string | null; importance?: number; difficulty?: number }
): Promise<BlockDTO | null> {
  const block = await prisma.studyBlock.findFirst({ where: { id: blockId, userId } });
  if (!block) return null;
  const data: Record<string, unknown> = {};
  if (fields.topic !== undefined && fields.topic.trim()) data.topic = fields.topic.trim().slice(0, 160);
  if (fields.subtopic !== undefined) data.subtopic = fields.subtopic && fields.subtopic.trim() ? fields.subtopic.trim().slice(0, 160) : null;
  if (fields.summary !== undefined) data.summary = fields.summary && fields.summary.trim() ? encrypt(fields.summary.trim().slice(0, 8000)) : null;
  if (fields.importance !== undefined) data.importance = Math.max(1, Math.min(4, Math.round(fields.importance)));
  if (fields.difficulty !== undefined) data.difficulty = Math.max(1, Math.min(4, Math.round(fields.difficulty)));

  const updated = await prisma.studyBlock.update({ where: { id: block.id }, data });
  const subject = await prisma.studySubject.findFirst({ where: { id: block.subjectId }, select: { code: true } });
  return toBlockDTO(updated, subject?.code ?? "?");
}

/**
 * Pasa TODO lo que vence hoy (o antes) a partir de mañana y lo reparte en los
 * próximos días hábiles respetando la capacidad. Útil cuando no llegaste a
 * estudiar y no querés que se acumule todo hoy.
 */
export async function postponeTodayForward(userId: string): Promise<number> {
  const endOfToday = endOfTodayArg();
  const startOfToday = startOfTodayArg();
  const tomorrow = new Date(startOfToday.getTime() + 86_400_000);
  tomorrow.setHours(12, 0, 0, 0);

  const due = await prisma.studyBlock.count({ where: { userId, status: "ACTIVO", nextReviewDate: { lte: endOfToday } } });
  if (due === 0) return 0;

  await prisma.studyBlock.updateMany({
    where: { userId, status: "ACTIVO", nextReviewDate: { lte: endOfToday } },
    data: { nextReviewDate: tomorrow },
  });
  await balanceUpcoming(userId).catch(() => {});
  return due;
}

/** Elimina definitivamente uno o varios bloques (y sus sesiones; desvincula ejercicios). */
export async function deleteBlocks(userId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  await prisma.studySession.deleteMany({ where: { userId, blockId: { in: ids } } });
  await prisma.studyExercise.updateMany({ where: { userId, blockId: { in: ids } }, data: { blockId: null } });
  const res = await prisma.studyBlock.deleteMany({ where: { userId, id: { in: ids } } });
  return res.count;
}

/**
 * "No lo vi": posterga el bloque al próximo día hábil sin registrar resultado
 * (no cambia nivel ni etapa). Después rebalancea para no sobrecargar ese día.
 */
export async function postponeBlock(userId: string, blockId: string): Promise<BlockDTO | null> {
  const block = await prisma.studyBlock.findFirst({ where: { id: blockId, userId } });
  if (!block) return null;

  const availability = await getAvailabilityMap(userId);
  const startOfToday = startOfTodayArg();
  const cursor = new Date(startOfToday.getTime() + 86_400_000);
  cursor.setHours(12, 0, 0, 0); // mañana ~9 ARG
  let safety = 0;
  while ((availability[cursor.getDay()] ?? 0) <= 0 && safety < 14) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(12, 0, 0, 0);
    safety++;
  }
  await prisma.studyBlock.update({ where: { id: block.id }, data: { nextReviewDate: new Date(cursor) } });
  await balanceUpcoming(userId).catch(() => {});

  const [updated, subject] = await Promise.all([
    prisma.studyBlock.findFirst({ where: { id: block.id } }),
    prisma.studySubject.findFirst({ where: { id: block.subjectId }, select: { code: true } }),
  ]);
  return updated ? toBlockDTO(updated, subject?.code ?? "?") : null;
}

/**
 * Rebalancea los repasos FUTUROS para que ningún día supere tu capacidad.
 * Recorre los bloques por fecha; si un día se llena, empuja el sobrante al
 * próximo día hábil con lugar. Nunca adelanta un repaso (respeta el espaciado
 * mínimo), solo lo corre hacia adelante cuando el día está sobrecargado.
 * Se llama solo al agregar bloques o cerrar sesiones. Devuelve cuántos movió.
 */
export async function balanceUpcoming(userId: string, now = new Date()): Promise<number> {
  const startOfToday = startOfTodayArg();
  const availability = await getAvailabilityMap(userId);
  if (!Object.values(availability).some((m) => m > 0)) return 0;

  const blocks = await prisma.studyBlock.findMany({
    where: { userId, status: "ACTIVO", nextReviewDate: { gte: startOfToday } },
  });
  if (blocks.length < 2) return 0;

  const [examDays, subjectsT] = await Promise.all([
    upcomingExamDaysBySubject(userId, now),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, type: true } }),
  ]);
  const typeMap = new Map(subjectsT.map((s) => [s.id, s.type]));
  const scoreOf = (b: (typeof blocks)[number]) =>
    priorityScore({ masteryLevel: b.masteryLevel, nextReviewDate: b.nextReviewDate, importance: b.importance, errorCount: b.errorCount, incorporationDate: b.incorporationDate }, now) +
    examBoost(examDays.get(b.subjectId) ?? null) + subjectTypeBoost(typeMap.get(b.subjectId));

  // Por fecha ascendente; a igual día, mayor prioridad conserva el lugar temprano.
  blocks.sort((a, b) => {
    const da = a.nextReviewDate!.getTime(), db = b.nextReviewDate!.getTime();
    return da !== db ? da - db : scoreOf(b) - scoreOf(a);
  });

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const todayNoon = new Date(startOfToday.getTime() + 15 * 3600 * 1000);
  const usedByDay = new Map<string, number>();
  let moved = 0;

  for (const block of blocks) {
    const dur = block.reviewDuration;
    let cursor = new Date(block.nextReviewDate!);
    cursor.setHours(12, 0, 0, 0);
    if (cursor < todayNoon) cursor = new Date(todayNoon);

    let safety = 0;
    let placed = false;
    while (safety < 120) {
      const cap = availability[cursor.getDay()] ?? 0;
      const used = usedByDay.get(key(cursor)) ?? 0;
      if (cap > 0 && used + dur <= cap) {
        if (key(cursor) !== key(block.nextReviewDate!)) {
          await prisma.studyBlock.update({ where: { id: block.id }, data: { nextReviewDate: new Date(cursor) } });
          moved++;
        }
        usedByDay.set(key(cursor), used + dur);
        placed = true;
        break;
      }
      cursor = new Date(cursor.getTime() + 86_400_000);
      cursor.setHours(12, 0, 0, 0);
      safety++;
    }
    // Si no entró en ningún lado (bloque más largo que cualquier día), lo dejamos.
    if (!placed) usedByDay.set(key(new Date(block.nextReviewDate!)), (usedByDay.get(key(new Date(block.nextReviewDate!))) ?? 0) + dur);
  }
  return moved;
}

/** Avanza el puntero de páginas procesadas del cuaderno (nunca retrocede). */
export async function advanceNotebookPointer(userId: string, subjectId: string, toPage: number): Promise<void> {
  const s = await prisma.studySubject.findFirst({ where: { id: subjectId, userId }, select: { notebookPages: true } });
  if (!s) return;
  if (toPage > s.notebookPages) {
    await prisma.studySubject.updateMany({ where: { id: subjectId, userId }, data: { notebookPages: toPage } });
  }
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

// Racha de estudio: días consecutivos (hora ARG) con al menos una sesión cerrada,
// contando hacia atrás desde hoy (o ayer, para no romperla si hoy todavía no
// estudiaste). Devuelve también cuántos repasos hiciste en los últimos 7 días.
export async function getStudyProgress(userId: string): Promise<{ streak: number; weekSessions: number }> {
  const now = Date.now();
  const since = new Date(now - 60 * 86_400_000);
  const sessions = await prisma.studySession.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const argDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const days = new Set(sessions.map((s) => argDay(s.createdAt)));

  const todayKey = argDay(new Date(now));
  let cursor = days.has(todayKey) ? new Date(now) : new Date(now - 86_400_000);
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (days.has(argDay(cursor))) { streak++; cursor = new Date(cursor.getTime() - 86_400_000); }
    else break;
  }

  const weekAgo = now - 7 * 86_400_000;
  const weekSessions = sessions.filter((s) => s.createdAt.getTime() >= weekAgo).length;
  return { streak, weekSessions };
}

// ─────────────────────────────────────────────
// Disponibilidad semanal (Sección — calendario/disponibilidad)
// ─────────────────────────────────────────────
export type AvailabilityDTO = { dayOfWeek: number; minutes: number };

/** Mapa día(0-6)→minutos, mergeando lo guardado con los valores por defecto. */
export async function getAvailabilityMap(userId: string): Promise<Record<number, number>> {
  const rows = await prisma.studyAvailability.findMany({ where: { userId } });
  const map: Record<number, number> = { ...DEFAULT_AVAILABILITY };
  for (const r of rows) map[r.dayOfWeek] = r.minutes;
  return map;
}

export async function listAvailability(userId: string): Promise<AvailabilityDTO[]> {
  const map = await getAvailabilityMap(userId);
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, minutes: map[d] ?? 0 }));
}

export async function setAvailability(userId: string, dayOfWeek: number, minutes: number): Promise<void> {
  const existing = await prisma.studyAvailability.findFirst({ where: { userId, dayOfWeek }, select: { id: true } });
  if (existing) {
    await prisma.studyAvailability.update({ where: { id: existing.id }, data: { minutes } });
  } else {
    await prisma.studyAvailability.create({ data: { userId, dayOfWeek, minutes } });
  }
}

// ─────────────────────────────────────────────
// Parciales / objetivos (Sección 15)
// ─────────────────────────────────────────────
export type ExamDTO = {
  id: string; subjectId: string; subjectCode: string; title: string;
  examDate: string; daysLeft: number; importance: number; done: boolean;
};

export async function listExams(userId: string, now = new Date()): Promise<ExamDTO[]> {
  const [exams, subjects] = await Promise.all([
    prisma.studyExam.findMany({ where: { userId }, orderBy: { examDate: "asc" } }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
  ]);
  const codeMap = new Map(subjects.map((s) => [s.id, s.code]));
  return exams.map((e) => ({
    id: e.id,
    subjectId: e.subjectId,
    subjectCode: codeMap.get(e.subjectId) ?? "?",
    title: e.title,
    examDate: e.examDate.toISOString(),
    daysLeft: Math.ceil((e.examDate.getTime() - now.getTime()) / 86_400_000),
    importance: e.importance,
    done: e.done,
  }));
}

export async function createExam(
  userId: string,
  input: { subjectId: string; title: string; examDate: Date; importance?: number; notes?: string | null }
): Promise<ExamDTO> {
  const subject = await prisma.studySubject.findFirst({ where: { id: input.subjectId, userId }, select: { id: true, code: true } });
  if (!subject) throw new Error("Materia no encontrada");
  const e = await prisma.studyExam.create({
    data: { userId, subjectId: subject.id, title: input.title, examDate: input.examDate, importance: input.importance ?? 3, notes: input.notes ?? null },
  });
  return {
    id: e.id, subjectId: e.subjectId, subjectCode: subject.code, title: e.title,
    examDate: e.examDate.toISOString(),
    daysLeft: Math.ceil((e.examDate.getTime() - Date.now()) / 86_400_000),
    importance: e.importance, done: e.done,
  };
}

export async function toggleExam(userId: string, id: string, done: boolean): Promise<void> {
  await prisma.studyExam.updateMany({ where: { id, userId }, data: { done } });
}
export async function deleteExam(userId: string, id: string): Promise<void> {
  await prisma.studyExam.deleteMany({ where: { id, userId } });
}

// ─────────────────────────────────────────────
// Ejercicios pendientes (Sección 13)
// ─────────────────────────────────────────────
export type ExerciseDTO = {
  id: string; blockId: string | null; subjectId: string | null; subjectCode: string | null;
  blockCode: string | null; description: string; source: string | null;
  done: boolean; dueDate: string | null;
};

export async function listExercises(userId: string, includeDone = false): Promise<ExerciseDTO[]> {
  const [rows, subjects, blocks] = await Promise.all([
    prisma.studyExercise.findMany({
      where: { userId, ...(includeDone ? {} : { done: false }) },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, code: true } }),
    prisma.studyBlock.findMany({ where: { userId }, select: { id: true, code: true } }),
  ]);
  const subjMap = new Map(subjects.map((s) => [s.id, s.code]));
  const blockMap = new Map(blocks.map((b) => [b.id, b.code]));
  return rows.map((x) => ({
    id: x.id,
    blockId: x.blockId,
    subjectId: x.subjectId,
    subjectCode: x.subjectId ? subjMap.get(x.subjectId) ?? null : null,
    blockCode: x.blockId ? blockMap.get(x.blockId) ?? null : null,
    description: decrypt(x.description) ?? "",
    source: x.source,
    done: x.done,
    dueDate: x.dueDate ? x.dueDate.toISOString() : null,
  }));
}

export async function createExercise(
  userId: string,
  input: { description: string; blockId?: string | null; subjectId?: string | null; source?: string | null; dueDate?: Date | null }
): Promise<void> {
  await prisma.studyExercise.create({
    data: {
      userId,
      description: encrypt(input.description) ?? input.description,
      blockId: input.blockId ?? null,
      subjectId: input.subjectId ?? null,
      source: input.source ?? null,
      dueDate: input.dueDate ?? null,
    },
  });
}

export async function toggleExercise(userId: string, id: string, done: boolean): Promise<void> {
  await prisma.studyExercise.updateMany({ where: { id, userId }, data: { done, doneAt: done ? new Date() : null } });
}
export async function deleteExercise(userId: string, id: string): Promise<void> {
  await prisma.studyExercise.deleteMany({ where: { id, userId } });
}

// Errores recientes: se derivan del log de sesiones (Sección 12), sin tabla aparte.
export type ErrorLogDTO = {
  id: string; blockCode: string; topic: string; category: string;
  description: string | null; date: string;
};
export async function listRecentErrors(userId: string, limit = 30): Promise<ErrorLogDTO[]> {
  const [sessions, blocks] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, errorCategory: { not: null } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.studyBlock.findMany({ where: { userId }, select: { id: true, code: true, topic: true } }),
  ]);
  const bMap = new Map(blocks.map((b) => [b.id, b]));
  return sessions.map((s) => {
    const b = bMap.get(s.blockId);
    return {
      id: s.id,
      blockCode: b?.code ?? "?",
      topic: b?.topic ?? "",
      category: s.errorCategory ?? "",
      description: decrypt(s.errorDescription),
      date: s.createdAt.toISOString(),
    };
  });
}

// ─────────────────────────────────────────────
// Reprogramación automática capacity-aware (Sección — nunca borrar sin nueva fecha).
// Toma los bloques vencidos (fecha < hoy) y los reparte hacia adelante en los
// próximos días disponibles, respetando la capacidad diaria y saltando descansos.
// Devuelve cuántos bloques se reprogramaron.
// ─────────────────────────────────────────────
export async function reprogramarVencidos(userId: string, now = new Date()): Promise<number> {
  const startOfToday = startOfTodayArg(); // medianoche ARG, en UTC

  const availability = await getAvailabilityMap(userId);
  const hasAnyCapacity = Object.values(availability).some((m) => m > 0);
  if (!hasAnyCapacity) return 0; // sin disponibilidad configurada, no reprogramamos

  const [overdue, subjects, futureBlocks] = await Promise.all([
    prisma.studyBlock.findMany({
      where: { userId, status: "ACTIVO", nextReviewDate: { lt: startOfToday } },
    }),
    prisma.studySubject.findMany({ where: { userId }, select: { id: true, type: true } }),
    // carga ya comprometida en días futuros (no vencida) para no sobrepasar capacidad
    prisma.studyBlock.findMany({
      where: { userId, status: "ACTIVO", nextReviewDate: { gte: startOfToday } },
      select: { nextReviewDate: true, reviewDuration: true },
    }),
  ]);
  const typeMap = new Map(subjects.map((s) => [s.id, s.type]));
  if (overdue.length === 0) return 0;

  const examDays = await upcomingExamDaysBySubject(userId, now);

  // minutos ya usados por día (clave = YYYY-MM-DD)
  const usedByDay = new Map<string, number>();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  for (const fb of futureBlocks) {
    if (fb.nextReviewDate) {
      const k = key(fb.nextReviewDate);
      usedByDay.set(k, (usedByDay.get(k) ?? 0) + fb.reviewDuration);
    }
  }

  // ordenar vencidos por prioridad (más atrasado / más importante primero)
  const ordered = overdue.sort((a, b) => {
    const sa = priorityScore({ masteryLevel: a.masteryLevel, nextReviewDate: a.nextReviewDate, importance: a.importance, errorCount: a.errorCount, incorporationDate: a.incorporationDate }, now) + examBoost(examDays.get(a.subjectId) ?? null) + subjectTypeBoost(typeMap.get(a.subjectId));
    const sb = priorityScore({ masteryLevel: b.masteryLevel, nextReviewDate: b.nextReviewDate, importance: b.importance, errorCount: b.errorCount, incorporationDate: b.incorporationDate }, now) + examBoost(examDays.get(b.subjectId) ?? null) + subjectTypeBoost(typeMap.get(b.subjectId));
    return sb - sa;
  });

  let cursor = new Date(startOfToday);
  cursor.setHours(12, 0, 0, 0);
  const advance = () => { cursor = new Date(cursor.getTime() + 86_400_000); cursor.setHours(12, 0, 0, 0); };

  let reprogrammed = 0;
  for (const block of ordered) {
    // buscar el primer día (desde hoy) con capacidad para este bloque
    let safety = 0;
    while (safety < 90) {
      const dow = cursor.getDay();
      const cap = availability[dow] ?? 0;
      const used = usedByDay.get(key(cursor)) ?? 0;
      if (cap > 0 && used + block.reviewDuration <= cap) {
        await prisma.studyBlock.update({
          where: { id: block.id },
          data: { nextReviewDate: new Date(cursor) },
        });
        usedByDay.set(key(cursor), used + block.reviewDuration);
        reprogrammed++;
        break;
      }
      advance();
      safety++;
    }
    // reiniciar cursor a hoy para el próximo bloque (así llena huecos de días tempranos)
    cursor = new Date(startOfToday);
    cursor.setHours(12, 0, 0, 0);
  }
  return reprogrammed;
}
