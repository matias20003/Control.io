/**
 * Correlativas y estado de carrera, con el modelo argentino de verdad.
 *
 * La pregunta que responde —"¿qué puedo cursar el cuatrimestre que viene?"— es
 * la que todo estudiante se hace en cada inscripción y la que ninguna app
 * internacional puede contestar, porque su modelo no tiene el estado que acá
 * define todo: **cursada aprobada con final pendiente**. Afuera una materia se
 * aprueba y se termina; acá puede quedar colgada meses o años, habilitando
 * algunas materias y bloqueando otras.
 */

export type SubjectStatus =
  | "PENDIENTE"          // ni cursada
  | "CURSANDO"
  | "CURSADA_APROBADA"   // cursada hecha, final pendiente: el "final colgado"
  | "APROBADA"           // final rendido, o promoción
  | "LIBRE"              // perdió la cursada, puede rendir libre
  | "ABANDONADA";

export type PrerequisiteKind =
  | "CURSAR_NECESITA_CURSADA"
  | "CURSAR_NECESITA_APROBADA"
  | "RENDIR_NECESITA_APROBADA";

export type SubjectLike = {
  id: string;
  name: string;
  code: string;
  status: string;
  planYear?: number | null;
  finalGrade?: number | null;
  cursadaGrade?: number | null;
  promoted?: boolean;
};

export type Prerequisite = {
  /** Presente cuando viene de la base; el motor no lo necesita para calcular. */
  id?: string;
  subjectId: string;
  requiredId: string;
  kind: string;
};

/** Tiene la cursada: aprobó de cursar, haya rendido el final o no. */
export function hasCursada(status: string): boolean {
  return status === "CURSADA_APROBADA" || status === "APROBADA";
}

/** Está aprobada del todo: rindió el final o promocionó. */
export function isApproved(status: string): boolean {
  return status === "APROBADA";
}

export type Blocker = { requiredId: string; requiredName: string; needs: "cursada" | "aprobada" };

export type SubjectAvailability = {
  /** ¿Puede anotarse a cursarla? */
  canCursar: boolean;
  /** ¿Puede rendir el final? Sólo aplica si ya tiene la cursada. */
  canRendirFinal: boolean;
  /** Qué le falta para poder cursarla. */
  blockers: Blocker[];
  /** Qué le falta para poder rendir el final. */
  finalBlockers: Blocker[];
};

/**
 * Qué puede cursar y qué puede rendir, materia por materia.
 *
 * Devuelve los bloqueantes con nombre y no sólo un sí/no: "no podés cursar
 * Análisis 2" sin decir qué falta obliga a ir a buscarlo a otro lado, que es
 * exactamente el trabajo que la persona quería evitar.
 */
export function availability(
  subjects: SubjectLike[],
  prerequisites: Prerequisite[],
): Map<string, SubjectAvailability> {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const result = new Map<string, SubjectAvailability>();

  for (const subject of subjects) {
    const own = prerequisites.filter((rule) => rule.subjectId === subject.id);
    const blockers: Blocker[] = [];
    const finalBlockers: Blocker[] = [];

    for (const rule of own) {
      const required = byId.get(rule.requiredId);
      // Una correlativa que apunta a una materia que ya no está no bloquea a
      // nadie: si se borró, es porque dejó de existir en el plan.
      if (!required) continue;

      if (rule.kind === "CURSAR_NECESITA_CURSADA" && !hasCursada(required.status)) {
        blockers.push({ requiredId: required.id, requiredName: required.name, needs: "cursada" });
      }
      if (rule.kind === "CURSAR_NECESITA_APROBADA" && !isApproved(required.status)) {
        blockers.push({ requiredId: required.id, requiredName: required.name, needs: "aprobada" });
      }
      if (rule.kind === "RENDIR_NECESITA_APROBADA" && !isApproved(required.status)) {
        finalBlockers.push({ requiredId: required.id, requiredName: required.name, needs: "aprobada" });
      }
    }

    result.set(subject.id, {
      canCursar: blockers.length === 0,
      canRendirFinal: hasCursada(subject.status) && !isApproved(subject.status) && finalBlockers.length === 0,
      blockers,
      finalBlockers,
    });
  }

  return result;
}

/** Las que puede anotarse a cursar el próximo cuatrimestre. */
export function availableToCursar(subjects: SubjectLike[], prerequisites: Prerequisite[]): SubjectLike[] {
  const map = availability(subjects, prerequisites);
  return subjects
    .filter((subject) => subject.status === "PENDIENTE" && map.get(subject.id)?.canCursar)
    .sort((a, b) => (a.planYear ?? 99) - (b.planYear ?? 99) || a.name.localeCompare(b.name));
}

/**
 * Los finales colgados: cursada aprobada y final sin rendir.
 *
 * Es el concepto que un estudiante argentino tuvo que programarse solo en
 * GitHub porque ninguna app lo tenía, y el que más materias hace perder de
 * vista: la cursada se aprobó, la materia "se siente" hecha, y el final queda.
 */
export function pendingFinals(subjects: SubjectLike[], prerequisites: Prerequisite[]) {
  const map = availability(subjects, prerequisites);
  return subjects
    .filter((subject) => subject.status === "CURSADA_APROBADA")
    .map((subject) => ({
      subject,
      canRendir: map.get(subject.id)?.canRendirFinal ?? false,
      blockers: map.get(subject.id)?.finalBlockers ?? [],
    }))
    .sort((a, b) => Number(b.canRendir) - Number(a.canRendir));
}

export type CareerProgress = {
  total: number;
  approved: number;
  cursadaOnly: number;
  cursando: number;
  pending: number;
  /** % de materias aprobadas del todo. */
  percent: number;
  /** Promedio con aplazos incluidos, que es el que pide la facultad. */
  average: number | null;
  /** Promedio contando sólo las aprobadas, que es el que sube el ánimo. */
  averageApproved: number | null;
};

/**
 * Cómo viene la carrera.
 *
 * Los dos promedios se calculan por separado a propósito: el que incluye
 * aplazos es el que figura en la certificación analítica y el que hace falta
 * para becas, y el que sólo cuenta aprobadas es el que la mayoría tiene en la
 * cabeza. Mostrar uno solo y llamarlo "tu promedio" siempre le miente a alguien.
 */
export function careerProgress(subjects: SubjectLike[], failedGrades: number[] = []): CareerProgress {
  const approved = subjects.filter((subject) => isApproved(subject.status));
  const grades = approved
    .map((subject) => subject.finalGrade ?? (subject.promoted ? subject.cursadaGrade : null))
    .filter((grade): grade is number => typeof grade === "number");

  const mean = (values: number[]) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;

  return {
    total: subjects.length,
    approved: approved.length,
    cursadaOnly: subjects.filter((subject) => subject.status === "CURSADA_APROBADA").length,
    cursando: subjects.filter((subject) => subject.status === "CURSANDO").length,
    pending: subjects.filter((subject) => subject.status === "PENDIENTE").length,
    percent: subjects.length ? Math.round((approved.length / subjects.length) * 100) : 0,
    average: mean([...grades, ...failedGrades]),
    averageApproved: mean(grades),
  };
}
