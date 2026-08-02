/**
 * Qué rutas se pueden abrir sin sesión.
 *
 * Vive fuera de proxy.ts para poder testearlo: olvidarse de sumar una ruta acá
 * no da un error de compilación, da un redirect silencioso a /login. Cuando el
 * que pide es un servidor externo (Meta descargando un documento, un cliente de
 * calendario), ese redirect devuelve el HTML del login y el cliente se lo guarda
 * como si fuera el archivo pedido. Ya pasó con el PDF de los reportes.
 */

/**
 * Públicas por prefijo. Las que no dependen de sesión se protegen con un token
 * secreto en la URL, que es la única credencial que un cliente externo puede
 * mandar.
 */
export const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/presentacion",
  "/grupos/unirse",
  "/api/whatsapp",
  // Se autentican con CRON_SECRET (Bearer), no con sesión: si el proxy los
  // redirige a /login, los crons nunca corren.
  "/api/cron",
  "/api/qstash",
  // Feed .ics: los clientes de calendario no mandan cookies. Token en la URL.
  "/api/estudio/calendar",
  // PDF de los reportes periódicos. Lo descarga Meta para adjuntarlo al mensaje
  // de WhatsApp, sin cookies, y también se abre desde el navegador interno de
  // WhatsApp, que tampoco tiene sesión. Protegido por un token de 48 hex en la
  // URL que valida la propia ruta.
  "/api/reports",
  "/api/google/calendar/webhook",
  "/api/diag",
  "/privacidad",
  "/terminos",
];

/** Públicas con match exacto, para no abrir todo el árbol con startsWith("/"). */
export const PUBLIC_EXACT = ["/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}
