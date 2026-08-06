import { prisma } from "@/lib/prisma";
import { availability, careerProgress, pendingFinals, type Prerequisite, type SubjectLike } from "@/lib/study-correlativas";
import { buildSchedule, type PlanConfig, type PlanItem } from "@/lib/study-planner";

/**
 * La carrera y los planes de estudio.
 *
 * Separado de `study-system.ts` porque son cosas distintas: aquello es el
 * sistema de repaso espaciado sobre bloques de material, y esto es el estado
 * administrativo de la carrera (qué debo, qué puedo cursar, qué final me queda
 * colgado) más el reparto del material de un examen.
 */

const dayString = (date: Date) => date.toISOString().slice(0, 10);

export async function getCareer(userId: string) {
  const [subjects, prerequisites] = await Promise.all([
    prisma.studySubject.findMany({
      where: { userId },
      orderBy: [{ planYear: "asc" }, { name: "asc" }],
    }),
    prisma.subjectPrerequisite.findMany({ where: { userId } }),
  ]);

  const plain: SubjectLike[] = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    status: subject.status,
    planYear: subject.planYear,
    finalGrade: subject.finalGrade,
    cursadaGrade: subject.cursadaGrade,
    promoted: subject.promoted,
  }));
  const rules: Prerequisite[] = prerequisites.map((rule) => ({
    id: rule.id,
    subjectId: rule.subjectId,
    requiredId: rule.requiredId,
    kind: rule.kind,
  }));

  const map = availability(plain, rules);
  return {
    subjects: plain.map((subject) => ({
      ...subject,
      ...(map.get(subject.id) ?? { canCursar: true, canRendirFinal: false, blockers: [], finalBlockers: [] }),
    })),
    prerequisites: rules,
    finals: pendingFinals(plain, rules),
    progress: careerProgress(plain),
  };
}

export type CareerData = Awaited<ReturnType<typeof getCareer>>;

export async function upsertSubject(userId: string, input: {
  id?: string; name: string; code: string; type?: string; planYear?: number | null;
  status?: string; cursadaGrade?: number | null; finalGrade?: number | null; promoted?: boolean;
}) {
  // Aprobar deja marca de cuándo: sin la fecha no se puede saber hace cuánto
  // que un final está colgado, que es justo lo que hay que poder ver.
  const now = new Date();
  const data = {
    name: input.name,
    code: input.code,
    type: input.type ?? "cuatrimestral",
    planYear: input.planYear ?? null,
    status: input.status ?? "PENDIENTE",
    cursadaGrade: input.cursadaGrade ?? null,
    finalGrade: input.finalGrade ?? null,
    promoted: input.promoted ?? false,
    ...(input.status === "CURSADA_APROBADA" || input.status === "APROBADA" ? { cursadaAt: now } : {}),
    ...(input.status === "APROBADA" ? { finalAt: now } : {}),
  };

  if (input.id) {
    const owned = await prisma.studySubject.findFirst({ where: { id: input.id, userId }, select: { id: true, cursadaAt: true } });
    if (!owned) throw new Error("Materia no encontrada");
    return prisma.studySubject.update({
      where: { id: input.id },
      // No se pisa la fecha de cursada si ya estaba: la primera es la buena.
      data: { ...data, ...(owned.cursadaAt ? { cursadaAt: owned.cursadaAt } : {}) },
    });
  }
  return prisma.studySubject.create({ data: { ...data, userId } });
}

export async function deleteSubject(userId: string, id: string) {
  const owned = await prisma.studySubject.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error("Materia no encontrada");
  await prisma.studySubject.delete({ where: { id } });
}

export async function addPrerequisite(userId: string, subjectId: string, requiredId: string, kind: string) {
  if (subjectId === requiredId) throw new Error("Una materia no puede ser correlativa de sí misma");
  const owned = await prisma.studySubject.findMany({
    where: { id: { in: [subjectId, requiredId] }, userId },
    select: { id: true },
  });
  if (owned.length !== 2) throw new Error("Materia no encontrada");
  return prisma.subjectPrerequisite.upsert({
    where: { subjectId_requiredId_kind: { subjectId, requiredId, kind } },
    create: { userId, subjectId, requiredId, kind },
    update: {},
  });
}

/** El deleteMany filtra por userId, así que nadie puede borrar la de otro. */
export async function deletePrerequisiteSafe(userId: string, id: string) {
  await prisma.subjectPrerequisite.deleteMany({ where: { id, userId } });
}

// ── Planes de estudio ────────────────────────────────────────

export async function getStudyPlans(userId: string) {
  const plans = await prisma.studyPlan.findMany({
    where: { userId },
    include: {
      exam: { select: { id: true, title: true, examDate: true, subjectId: true, kind: true, done: true } },
      items: { orderBy: [{ scheduledFor: "asc" }, { position: "asc" }] },
    },
    orderBy: { createdAt: "desc" },
  });
  return plans.map((plan) => ({
    id: plan.id,
    examId: plan.examId,
    examTitle: plan.exam.title,
    examDate: plan.exam.examDate.toISOString(),
    examKind: plan.exam.kind,
    subjectId: plan.exam.subjectId,
    minutesPerDay: plan.minutesPerDay,
    reviewDays: plan.reviewDays,
    rebalancedAt: plan.rebalancedAt?.toISOString() ?? null,
    items: plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      minutes: item.minutes,
      weight: item.weight,
      position: item.position,
      done: item.done,
      isReview: item.isReview,
      scheduledFor: item.scheduledFor ? dayString(item.scheduledFor) : null,
    })),
  }));
}

export type StudyPlanData = Awaited<ReturnType<typeof getStudyPlans>>[number];

/** Crea el plan y reparte el material de una. */
export async function createStudyPlan(userId: string, input: {
  examId: string;
  minutesPerDay: number[];
  reviewDays: number;
  items: { title: string; minutes: number; weight: number; isReview?: boolean }[];
  today: string;
}) {
  const exam = await prisma.studyExam.findFirst({
    where: { id: input.examId, userId },
    select: { id: true, examDate: true },
  });
  if (!exam) throw new Error("Examen no encontrado");

  const planItems: PlanItem[] = input.items.map((item, index) => ({
    id: String(index),
    title: item.title,
    minutes: item.minutes,
    weight: item.weight,
    position: index,
    done: false,
    isReview: item.isReview ?? false,
  }));
  const config: PlanConfig = { minutesPerDay: input.minutesPerDay, reviewDays: input.reviewDays };
  const schedule = buildSchedule(planItems, input.today, dayString(exam.examDate), config);

  return prisma.studyPlan.create({
    data: {
      userId,
      examId: input.examId,
      minutesPerDay: input.minutesPerDay,
      reviewDays: input.reviewDays,
      items: {
        create: schedule.items.map((item) => ({
          title: item.title,
          minutes: item.minutes,
          weight: item.weight,
          position: item.position,
          isReview: item.isReview,
          scheduledFor: item.scheduledFor ? new Date(`${item.scheduledFor}T00:00:00.000Z`) : null,
        })),
      },
    },
  });
}

/**
 * Rehace el reparto desde hoy con lo que quedó sin hacer.
 *
 * Es la función que sostiene todo lo demás: nadie cumple un cronograma de
 * estudio al pie de la letra, y un plan que no se puede reacomodar se abandona
 * el primer día que se incumple.
 */
export async function rebalancePlan(userId: string, planId: string, today: string) {
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId, userId },
    include: { exam: { select: { examDate: true } }, items: true },
  });
  if (!plan) throw new Error("Plan no encontrado");

  const items: PlanItem[] = plan.items.map((item) => ({
    id: item.id,
    title: item.title,
    minutes: item.minutes,
    weight: item.weight,
    position: item.position,
    done: item.done,
    isReview: item.isReview,
  }));
  const schedule = buildSchedule(
    items,
    today,
    dayString(plan.exam.examDate),
    { minutesPerDay: plan.minutesPerDay, reviewDays: plan.reviewDays },
  );

  // Sólo se reescriben las fechas; nada de lo hecho se toca.
  await prisma.$transaction([
    ...schedule.items
      .filter((item) => !item.done)
      .map((item) =>
        prisma.studyPlanItem.update({
          where: { id: item.id },
          data: { scheduledFor: item.scheduledFor ? new Date(`${item.scheduledFor}T00:00:00.000Z`) : null },
        }),
      ),
    prisma.studyPlan.update({ where: { id: planId }, data: { rebalancedAt: new Date() } }),
  ]);

  return { missingMinutes: schedule.missingMinutes, overflow: schedule.overflow.length };
}

export async function togglePlanItem(userId: string, itemId: string) {
  const item = await prisma.studyPlanItem.findFirst({
    where: { id: itemId, plan: { userId } },
    select: { id: true, done: true },
  });
  if (!item) throw new Error("Ítem no encontrado");
  return prisma.studyPlanItem.update({
    where: { id: itemId },
    data: { done: !item.done, doneAt: item.done ? null : new Date() },
  });
}

export async function deleteStudyPlan(userId: string, planId: string) {
  await prisma.studyPlan.deleteMany({ where: { id: planId, userId } });
}

/**
 * Lo que toca estudiar hoy, de todos los planes vivos.
 *
 * Es lo que hace que Estudio no sea una isla: el plan del parcial aparece en el
 * día junto a las tareas y los vencimientos, que es donde la persona mira.
 */
export async function getStudyToday(userId: string, day: string) {
  const items = await prisma.studyPlanItem.findMany({
    where: {
      plan: { userId },
      done: false,
      scheduledFor: { lte: new Date(`${day}T00:00:00.000Z`) },
    },
    include: { plan: { include: { exam: { select: { title: true, examDate: true } } } } },
    orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
    take: 20,
  });
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    minutes: item.minutes,
    isReview: item.isReview,
    examTitle: item.plan.exam.title,
    examDate: item.plan.exam.examDate.toISOString(),
    scheduledFor: item.scheduledFor ? dayString(item.scheduledFor) : null,
  }));
}
