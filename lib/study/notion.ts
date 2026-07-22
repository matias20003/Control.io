import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { createBlocksDistributed } from "@/lib/db/study-system";

const NOTION_VERSION = "2022-06-28";

// ─────────────────────────────────────────────
// Config (token cifrado + database id + token del calendario ICS)
// ─────────────────────────────────────────────
export type NotionConfig = { connected: boolean; dbId: string | null; hasIcs: boolean };

export async function getNotionConfigView(userId: string): Promise<NotionConfig> {
  const row = await prisma.studySettings.findUnique({
    where: { userId },
    select: { notionToken: true, notionDbId: true, icsToken: true },
  });
  return { connected: !!row?.notionToken, dbId: row?.notionDbId ?? null, hasIcs: !!row?.icsToken };
}

/** Devuelve el token descifrado (uso interno del server). */
async function getNotionToken(userId: string): Promise<{ token: string; dbId: string } | null> {
  const row = await prisma.studySettings.findUnique({ where: { userId }, select: { notionToken: true, notionDbId: true } });
  if (!row?.notionToken || !row.notionDbId) return null;
  const token = decrypt(row.notionToken);
  if (!token) return null;
  return { token, dbId: row.notionDbId };
}

/** Normaliza un id/URL de base de datos de Notion a los 32 chars hex. */
export function normalizeNotionDbId(input: string): string | null {
  const m = input.replace(/-/g, "").match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : null;
}

export async function setNotionConfig(userId: string, token: string, dbId: string): Promise<void> {
  await prisma.studySettings.upsert({
    where: { userId },
    create: { userId, notionToken: encrypt(token), notionDbId: dbId },
    update: { notionToken: encrypt(token), notionDbId: dbId },
  });
}

export async function disconnectNotion(userId: string): Promise<void> {
  await prisma.studySettings.updateMany({ where: { userId }, data: { notionToken: null, notionDbId: null } });
}

// ─────────────────────────────────────────────
// Lectura de la base de Notion
// ─────────────────────────────────────────────
type NotionProp = { type: string; [k: string]: unknown };
type NotionPage = { id: string; properties?: Record<string, NotionProp> };

function plainFromRich(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((r) => (r && typeof r === "object" && "plain_text" in r ? String((r as { plain_text: unknown }).plain_text ?? "") : "")).join("").trim();
}

function readProp(prop: NotionProp | undefined): string | number | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title": return plainFromRich(prop.title);
    case "rich_text": return plainFromRich(prop.rich_text);
    case "select": return (prop.select as { name?: string } | null)?.name ?? null;
    case "multi_select": return (prop.multi_select as { name?: string }[] | undefined)?.map((s) => s.name).filter(Boolean).join(", ") ?? null;
    case "number": return typeof prop.number === "number" ? prop.number : null;
    case "status": return (prop.status as { name?: string } | null)?.name ?? null;
    case "date": return (prop.date as { start?: string } | null)?.start ?? null;
    default: return null;
  }
}

function findProp(props: Record<string, NotionProp>, re: RegExp, types: string[]): NotionProp | undefined {
  for (const [name, p] of Object.entries(props)) {
    if (types.includes(p.type) && re.test(name)) return p;
  }
  return undefined;
}

function titleProp(props: Record<string, NotionProp>): NotionProp | undefined {
  return Object.values(props).find((p) => p.type === "title");
}

function toLevel(v: string | number | null): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Math.max(1, Math.min(4, Math.round(v)));
  const s = String(v).toLowerCase();
  if (/muy alta|muy dif|cr[ií]tic/.test(s)) return 4;
  if (/alta|dif[ií]cil/.test(s)) return 3;
  if (/media|medio/.test(s)) return 2;
  if (/baja|f[aá]cil/.test(s)) return 1;
  return undefined;
}

export type NotionProposal = {
  topic: string; unit: string | null; summary: string | null;
  difficulty?: number; importance?: number;
};

/** Mapea las páginas de la base a bloques propuestos (heurística por nombre de propiedad). */
export async function readNotionProposals(userId: string): Promise<{ ok: boolean; error?: string; proposals: NotionProposal[] }> {
  const cfg = await getNotionToken(userId);
  if (!cfg) return { ok: false, error: "Notion no está conectado", proposals: [] };

  const proposals: NotionProposal[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 5; page++) { // hasta 500 filas
      const res = await fetch(`https://api.notion.com/v1/databases/${cfg.dbId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      if (!res.ok) {
        const msg = res.status === 401 ? "Token de Notion inválido o sin acceso a la base" : res.status === 404 ? "No encuentro la base (¿compartiste la base con la integración?)" : `Notion respondió ${res.status}`;
        return { ok: false, error: msg, proposals: [] };
      }
      const j = (await res.json()) as { results?: NotionPage[]; has_more?: boolean; next_cursor?: string | null };
      for (const pg of j.results ?? []) {
        const props = pg.properties ?? {};
        const topic = String(readProp(titleProp(props)) ?? "").slice(0, 160).trim();
        if (!topic) continue;
        const unit = readProp(findProp(props, /unidad|unit|m[oó]dulo/i, ["select", "rich_text", "multi_select"]));
        const summary = readProp(findProp(props, /resumen|descrip|summary|detalle|nota|contenido/i, ["rich_text"]));
        const importance = toLevel(readProp(findProp(props, /importan|prioridad|priority/i, ["number", "select", "status"])));
        const difficulty = toLevel(readProp(findProp(props, /dificultad|difficulty|complej/i, ["number", "select", "status"])));
        proposals.push({
          topic,
          unit: unit ? String(unit).slice(0, 80) : null,
          summary: summary ? String(summary).slice(0, 6000) : null,
          importance, difficulty,
        });
      }
      if (!j.has_more || !j.next_cursor) break;
      cursor = j.next_cursor;
    }
    return { ok: true, proposals };
  } catch {
    return { ok: false, error: "No pude conectarme con Notion", proposals: [] };
  }
}

/** Importa las páginas de Notion como bloques de la materia/parcial elegidos. */
export async function importFromNotion(
  userId: string, subjectId: string, parcial: number
): Promise<{ ok: boolean; error?: string; imported: number }> {
  const read = await readNotionProposals(userId);
  if (!read.ok) return { ok: false, error: read.error, imported: 0 };
  if (read.proposals.length === 0) return { ok: false, error: "La base de Notion no tiene filas con título", imported: 0 };
  const created = await createBlocksDistributed(
    userId, subjectId, parcial,
    read.proposals.map((p) => ({ topic: p.topic, unit: p.unit, summary: p.summary, importance: p.importance, difficulty: p.difficulty, source: "Notion" })),
  );
  return { ok: true, imported: created.length };
}

// ─────────────────────────────────────────────
// Token del feed ICS (calendario)
// ─────────────────────────────────────────────
export async function getOrCreateIcsToken(userId: string): Promise<string> {
  const row = await prisma.studySettings.findUnique({ where: { userId }, select: { icsToken: true } });
  if (row?.icsToken) return row.icsToken;
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.studySettings.upsert({
    where: { userId },
    create: { userId, icsToken: token },
    update: { icsToken: token },
  });
  return token;
}
