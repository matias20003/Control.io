import { NextResponse, type NextRequest } from "next/server";

// /login/verify cae bajo el prefijo /login.
// /setup-2fa NO es pública — requiere sesión activa (la página la valida).
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth", "/presentacion", "/grupos/unirse"];
// Rutas públicas con match exacto (para no abrir todo el árbol con startsWith("/")).
const PUBLIC_EXACT = ["/"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Chequeo optimista: si no hay cookie de sesión y la ruta es protegida, redirigir al login.
  // NO redirigimos de login→dashboard aquí porque la cookie puede estar expirada,
  // lo que causaría un loop infinito. El dashboard/layout valida la sesión real con Supabase.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hasSession && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
