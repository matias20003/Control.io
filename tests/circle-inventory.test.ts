import { describe, expect, it } from "vitest";
import {
  cutChecklist,
  inventoryProgress,
  parseFollowingExport,
  parseFollowingFile,
} from "@/lib/circle-inventory";

// Forma actual del export de Instagram.
const EXPORT_ACTUAL = {
  relationships_following: [
    {
      title: "Mateo Lopez",
      string_list_data: [
        { href: "https://www.instagram.com/mateolopez", value: "mateolopez", timestamp: 1 },
      ],
    },
    {
      title: "",
      string_list_data: [
        { href: "https://www.instagram.com/estudio.arq", value: "estudio.arq", timestamp: 2 },
      ],
    },
  ],
};

describe("parseFollowingExport", () => {
  it("lee la forma actual del export", () => {
    expect(parseFollowingExport(EXPORT_ACTUAL)).toEqual([
      { handle: "mateolopez", fullName: "Mateo Lopez" },
      { handle: "estudio.arq", fullName: null },
    ]);
  });

  it("lee exports viejos que venian como array suelto", () => {
    const viejo = EXPORT_ACTUAL.relationships_following;
    expect(parseFollowingExport(viejo)).toHaveLength(2);
  });

  it("lee la variante con clave 'following'", () => {
    expect(
      parseFollowingExport({ following: EXPORT_ACTUAL.relationships_following }),
    ).toHaveLength(2);
  });

  it("saca el handle de la URL cuando falta el value", () => {
    const sinValue = {
      relationships_following: [
        { title: "X", string_list_data: [{ href: "https://instagram.com/soloenlink/" }] },
      ],
    };
    expect(parseFollowingExport(sinValue)).toEqual([
      { handle: "soloenlink", fullName: "X" },
    ]);
  });

  it("no repite cuentas", () => {
    const repetido = {
      relationships_following: [
        { title: "A", string_list_data: [{ value: "misma" }] },
        { title: "B", string_list_data: [{ value: "MISMA" }] },
      ],
    };
    expect(parseFollowingExport(repetido)).toHaveLength(1);
  });

  it("descarta entradas sin handle valido en vez de inventarlo", () => {
    const roto = {
      relationships_following: [
        { title: "Sin lista" },
        { title: "Vacia", string_list_data: [] },
        { title: "Rara", string_list_data: [{ value: "no valido!!" }] },
        { title: "Buena", string_list_data: [{ value: "buena" }] },
      ],
    };
    expect(parseFollowingExport(roto)).toEqual([{ handle: "buena", fullName: "Buena" }]);
  });

  it("no toma un handle de un dominio que no es Instagram", () => {
    const ajeno = {
      relationships_following: [
        { title: "X", string_list_data: [{ href: "https://evil.com/alguien" }] },
      ],
    };
    expect(parseFollowingExport(ajeno)).toEqual([]);
  });

  it("un archivo que no es JSON devuelve vacio sin explotar", () => {
    expect(parseFollowingFile("no soy json")).toEqual([]);
    expect(parseFollowingFile("")).toEqual([]);
  });

  it("no confunde el nombre con el handle cuando son iguales", () => {
    const igual = {
      relationships_following: [{ title: "buena", string_list_data: [{ value: "buena" }] }],
    };
    expect(parseFollowingExport(igual)[0].fullName).toBeNull();
  });
});

describe("inventoryProgress", () => {
  it("cuenta cuanto falta clasificar", () => {
    const progreso = inventoryProgress([
      { decision: "PERSON" },
      { decision: "REFERENCE" },
      { decision: "NOISE" },
      { decision: "PENDING" },
    ]);
    expect(progreso).toMatchObject({
      total: 4,
      pending: 1,
      classified: 3,
      people: 1,
      references: 1,
      noise: 1,
      percent: 75,
    });
  });

  it("un inventario vacio no divide por cero", () => {
    expect(inventoryProgress([])).toMatchObject({ total: 0, percent: 0 });
  });
});

describe("cutChecklist", () => {
  const listo = {
    peopleWithPhone: 5,
    peopleTotal: 5,
    referencesWithChannel: 8,
    referencesTotal: 8,
    pendingInventory: 0,
  };

  it("habilita el corte cuando el reemplazo esta completo", () => {
    const check = cutChecklist(listo);
    expect(check.ready).toBe(true);
    expect(check.blockers).toEqual([]);
  });

  it("avisa por las personas sin telefono: es lo que se pierde al desinstalar", () => {
    const check = cutChecklist({ ...listo, peopleWithPhone: 3 });
    expect(check.ready).toBe(false);
    expect(check.blockers[0]).toContain("2 personas sin teléfono");
  });

  it("avisa por los referentes huerfanos", () => {
    const check = cutChecklist({ ...listo, referencesWithChannel: 7 });
    expect(check.blockers[0]).toContain("1 referente sin canal propio");
  });

  it("avisa por el inventario a medio clasificar", () => {
    const check = cutChecklist({ ...listo, pendingInventory: 12 });
    expect(check.blockers[0]).toContain("12 cuentas");
  });

  it("no deja cortar sin haber cargado a nadie", () => {
    const check = cutChecklist({ ...listo, peopleTotal: 0, peopleWithPhone: 0 });
    expect(check.ready).toBe(false);
    expect(check.blockers[0]).toContain("Cercanos");
  });

  it("sin referentes cargados no inventa un bloqueo", () => {
    const check = cutChecklist({ ...listo, referencesTotal: 0, referencesWithChannel: 0 });
    expect(check.ready).toBe(true);
  });
});
