import type { SubjectDTO } from "@/lib/db/study-system";

// Paleta de colores por materia (legible en dark y light). Se asigna por orden;
// si la materia tiene su propio color guardado, se respeta.
export const SUBJECT_PALETTE = [
  "#60a5fa", // azul
  "#f472b6", // rosa
  "#34d399", // verde
  "#fbbf24", // ámbar
  "#a78bfa", // violeta
  "#f87171", // rojo
  "#22d3ee", // cyan
  "#fb923c", // naranja
  "#a3e635", // lima
  "#e879f9", // fucsia
];

function isHex(v: string | null | undefined): v is string {
  return !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

/** Mapa materiaId → color hex (respeta el color propio; si no, asigna por orden). */
export function buildSubjectColors(subjects: SubjectDTO[]): Map<string, string> {
  const map = new Map<string, string>();
  subjects.forEach((s, i) => {
    map.set(s.id, isHex(s.color) ? s.color : SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]);
  });
  return map;
}
