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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-* requerido por Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "resend", "@prisma/client", "pg"],
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
