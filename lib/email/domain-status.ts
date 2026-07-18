/**
 * Estado real de verificación del dominio remitente en Resend.
 *
 * Sin dominio verificado, Resend RECHAZA todos los envíos (la reactivación,
 * recordatorios, etc. fallan con "domain is not verified"). Esto consulta la
 * API de Resend para que el admin vea el estado real en el panel, en vez de
 * enterarse recién cuando un envío falla.
 */
import { FROM } from "./client";

export type ResendDomainStatus =
  | { state: "no-key" }
  | { state: "error"; message: string }
  | { state: "not-found"; domain: string }
  | { state: "found"; domain: string; status: string; verified: boolean };

/** Extrae el dominio del remitente (ej: "control.io <noreply@controlio.site>" → "controlio.site"). */
export function senderDomain(from = FROM): string | null {
  return from.match(/@([^>\s]+)/)?.[1] ?? null;
}

export async function getResendDomainStatus(): Promise<ResendDomainStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { state: "no-key" };

  const domain = senderDomain();
  if (!domain) return { state: "error", message: "No se pudo leer el dominio del remitente." };

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      // Evita cachear estado stale: queremos el valor real en cada carga del admin.
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      return { state: "error", message: json?.message ?? `Resend respondió ${res.status}` };
    }
    const list: { name: string; status: string }[] = json?.data ?? [];
    const match = list.find((d) => d.name === domain);
    if (!match) return { state: "not-found", domain };
    return { state: "found", domain, status: match.status, verified: match.status === "verified" };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
