import type { NextConfig } from "next";

const securityHeaders = [
  // Evita que la app se embeba en iframes de otros dominios (clickjacking)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Evita que el browser "adivine" el content-type (MIME sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Controla qué info de referrer se envía en requests externos
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Fuerza HTTPS por 1 año, incluye subdominios
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Deshabilita acceso a micrófono, cámara, geolocalización por defecto
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content Security Policy básica
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-* requerido por Next.js; us-assets.i.posthog.com sirve los scripts de PostHog
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      // Supabase + PostHog (ingesta de eventos y assets) + Sentry (errores)
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
      // Session replay de PostHog usa web workers (blob)
      "worker-src 'self' blob:",
      // Música de enfoque embebida (YouTube) en el Modo Enfoque de /estudio
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto para Turbopack. Sin esto, los package-lock.json
  // sueltos en carpetas padre (C:\Users\yoris\, ...\Finanzas Personales\) hacen
  // que Turbopack infiera la raíz equivocada y no resuelva Tailwind/módulos.
  turbopack: { root: __dirname },
  serverExternalPackages: ["web-push", "resend", "@prisma/client", "pg", "imapflow", "pdf-parse", "mupdf"],
  // Aseguramos que el .wasm de mupdf viaje al bundle serverless del route que
  // rasteriza PDFs (el file tracing a veces no incluye los .wasm solo).
  outputFileTracingIncludes: {
    "/api/estudio/analyze": ["./node_modules/mupdf/dist/*.wasm"],
    // La rasterización también corre como server action bajo la página /estudio.
    "/estudio": ["./node_modules/mupdf/dist/*.wasm"],
    "/estudio/**": ["./node_modules/mupdf/dist/*.wasm"],
  },
  experimental: {
    // Cachea en el navegador las páginas ya visitadas: volver a una pantalla
    // reciente es instantáneo (sin re-fetch). Las acciones hacen revalidatePath,
    // así que tras crear/editar un movimiento se ven los datos frescos igual.
    staleTimes: { dynamic: 30, static: 180 },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
