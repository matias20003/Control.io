import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/public-routes";

/**
 * Estas rutas las consume un cliente externo que NO puede mandar cookies. Si
 * alguna deja de ser pública, el proxy responde el HTML del login y el cliente
 * lo guarda como si fuera el archivo pedido: por eso el PDF del reporte llegaba
 * a WhatsApp siendo la pantalla de "Bienvenido de nuevo".
 */
describe("rutas que consumen clientes sin sesión", () => {
  it("el PDF de los reportes es público (lo descarga Meta para adjuntarlo)", () => {
    expect(isPublicPath("/api/reports/pdf/abc123")).toBe(true);
  });

  it("los crons son públicos (se autentican con CRON_SECRET)", () => {
    expect(isPublicPath("/api/cron/reminders")).toBe(true);
    expect(isPublicPath("/api/qstash/reminder")).toBe(true);
  });

  it("el feed .ics es público (los clientes de calendario no mandan cookies)", () => {
    expect(isPublicPath("/api/estudio/calendar")).toBe(true);
  });

  it("los webhooks entrantes son públicos", () => {
    expect(isPublicPath("/api/whatsapp/kapso")).toBe(true);
    expect(isPublicPath("/api/google/calendar/webhook")).toBe(true);
  });
});

describe("lo que sigue necesitando sesión", () => {
  it("el dashboard y las secciones privadas", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/calendario")).toBe(false);
    expect(isPublicPath("/movimientos")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
  });

  it("setup-2fa no es pública", () => {
    expect(isPublicPath("/setup-2fa")).toBe(false);
  });

  it("el resto de la API sigue protegida", () => {
    expect(isPublicPath("/api/export/transactions")).toBe(false);
    expect(isPublicPath("/api/device-sessions")).toBe(false);
    expect(isPublicPath("/api/admin/migrate-encrypt")).toBe(false);
  });

  it("la raíz es pública pero no abre todo el árbol", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/cuentas")).toBe(false);
  });
});
