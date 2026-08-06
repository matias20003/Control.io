import { describe, expect, it } from "vitest";
import {
  availability, availableToCursar, careerProgress, hasCursada, isApproved, pendingFinals,
  type Prerequisite, type SubjectLike,
} from "@/lib/study-correlativas";

const subject = (id: string, status: string, extra: Partial<SubjectLike> = {}): SubjectLike => ({
  id, name: id, code: id.toUpperCase(), status, ...extra,
});

const rule = (subjectId: string, requiredId: string, kind: string): Prerequisite => ({
  subjectId, requiredId, kind,
});

describe("estados de una materia argentina", () => {
  it("cursada aprobada cuenta como cursada pero no como aprobada", () => {
    expect(hasCursada("CURSADA_APROBADA")).toBe(true);
    expect(isApproved("CURSADA_APROBADA")).toBe(false);
    expect(isApproved("APROBADA")).toBe(true);
  });
});

describe("availability", () => {
  it("con la cursada de la correlativa ya puede cursar la siguiente", () => {
    const am1 = subject("am1", "CURSADA_APROBADA"); // final colgado
    const am2 = subject("am2", "PENDIENTE");
    const map = availability([am1, am2], [rule("am2", "am1", "CURSAR_NECESITA_CURSADA")]);
    expect(map.get("am2")?.canCursar).toBe(true);
  });

  it("si la correlativa exige final aprobado, la cursada no alcanza", () => {
    const am1 = subject("am1", "CURSADA_APROBADA");
    const am2 = subject("am2", "PENDIENTE");
    const map = availability([am1, am2], [rule("am2", "am1", "CURSAR_NECESITA_APROBADA")]);
    expect(map.get("am2")?.canCursar).toBe(false);
    expect(map.get("am2")?.blockers).toEqual([
      { requiredId: "am1", requiredName: "am1", needs: "aprobada" },
    ]);
  });

  it("dice que falta, no solo que no se puede", () => {
    const map = availability(
      [subject("fis", "PENDIENTE"), subject("am2", "PENDIENTE")],
      [rule("fis", "am2", "CURSAR_NECESITA_CURSADA")],
    );
    expect(map.get("fis")?.blockers[0].requiredName).toBe("am2");
  });

  it("una correlativa que apunta a una materia borrada no bloquea", () => {
    const map = availability([subject("fis", "PENDIENTE")], [rule("fis", "fantasma", "CURSAR_NECESITA_CURSADA")]);
    expect(map.get("fis")?.canCursar).toBe(true);
  });

  it("solo puede rendir el final si tiene la cursada y no lo rindio", () => {
    const map = availability(
      [subject("am1", "CURSADA_APROBADA"), subject("am2", "APROBADA"), subject("fis", "PENDIENTE")],
      [],
    );
    expect(map.get("am1")?.canRendirFinal).toBe(true);
    expect(map.get("am2")?.canRendirFinal).toBe(false); // ya la aprobo
    expect(map.get("fis")?.canRendirFinal).toBe(false); // ni la curso
  });
});

describe("availableToCursar", () => {
  it("solo lista pendientes desbloqueadas, ordenadas por ano de plan", () => {
    const subjects = [
      subject("tercero", "PENDIENTE", { planYear: 3 }),
      subject("primero", "PENDIENTE", { planYear: 1 }),
      subject("cursando", "CURSANDO", { planYear: 1 }),
      subject("bloqueada", "PENDIENTE", { planYear: 1 }),
      subject("previa", "PENDIENTE", { planYear: 1 }),
    ];
    const disponibles = availableToCursar(subjects, [rule("bloqueada", "previa", "CURSAR_NECESITA_CURSADA")]);
    expect(disponibles.map((s) => s.id)).toEqual(["previa", "primero", "tercero"]);
  });
});

describe("pendingFinals", () => {
  it("saca los finales colgados y dice cuales se pueden rendir ya", () => {
    const subjects = [
      subject("am1", "CURSADA_APROBADA"),
      subject("am2", "CURSADA_APROBADA"),
      subject("fis", "APROBADA"),
    ];
    // Para rendir am2 hace falta am1 aprobada, y am1 todavia no lo esta.
    const finals = pendingFinals(subjects, [rule("am2", "am1", "RENDIR_NECESITA_APROBADA")]);
    expect(finals).toHaveLength(2);
    expect(finals[0].subject.id).toBe("am1");
    expect(finals[0].canRendir).toBe(true);
    const am2 = finals.find((f) => f.subject.id === "am2")!;
    expect(am2.canRendir).toBe(false);
    expect(am2.blockers[0].requiredName).toBe("am1");
  });
});

describe("careerProgress", () => {
  it("cuenta cada estado por separado", () => {
    const progress = careerProgress([
      subject("a", "APROBADA", { finalGrade: 8 }),
      subject("b", "CURSADA_APROBADA"),
      subject("c", "CURSANDO"),
      subject("d", "PENDIENTE"),
    ]);
    expect(progress.total).toBe(4);
    expect(progress.approved).toBe(1);
    expect(progress.cursadaOnly).toBe(1);
    expect(progress.cursando).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.percent).toBe(25);
  });

  it("la promocionada promedia con la nota de cursada", () => {
    const progress = careerProgress([subject("a", "APROBADA", { promoted: true, cursadaGrade: 9 })]);
    expect(progress.averageApproved).toBe(9);
  });

  it("los aplazos bajan un promedio y no el otro", () => {
    const subjects = [subject("a", "APROBADA", { finalGrade: 8 }), subject("b", "APROBADA", { finalGrade: 6 })];
    const progress = careerProgress(subjects, [2]);
    expect(progress.averageApproved).toBe(7);          // el que uno tiene en la cabeza
    expect(progress.average).toBeCloseTo(5.33, 1);     // el del analitico
  });
});
