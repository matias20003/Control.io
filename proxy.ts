import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/public-routes";

// La lista de rutas públicas vive en lib/public-routes.ts para poder testearla:
// olvidarse de sumar una no rompe la compilación, devuelve el HTML del login.
// /login/verify cae bajo el prefijo /login.
// /setup-2fa NO es pública — requiere sesión activa (la página la valida).

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    isPublicPath(pathname) ||
    (process.env.BRIEF_E2E_FIXTURE === "1" &&
      ["/brief-mobile-fixture", "/circle-fixture"].includes(pathname));

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
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
