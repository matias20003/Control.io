/**
 * Escapa caracteres HTML para interpolar valores controlados por el usuario
 * (nombres de usuario, de grupo, de categoría/cuenta) dentro de los templates de
 * email SIN riesgo de inyección de HTML/links (phishing, content-spoofing).
 * Devuelve "" para null/undefined.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
