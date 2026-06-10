import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/components/PostHogProvider";
import { AppSplash } from "@/components/layout/AppSplash";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "control.io", template: "%s — control.io" },
  description: "Tu sistema de finanzas personales. Entendé tu dinero.",
  // icon/shortcut: Next.js detecta app/icon.svg solo; sumamos el apple-touch-icon
  // PNG (Safari ignora SVG para el ícono de "Agregar a inicio").
  icons: {
    apple: "/apple-touch-icon.png",
  },
  // Modo app en iOS: pantalla completa al abrir desde el ícono de inicio.
  // statusBarStyle "default" = barra blanca con texto oscuro, empalma con el
  // tema claro y evita que el contenido quede debajo de la barra.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "control.io",
  },
};

export const viewport: Viewport = {
  // Default claro → la barra del navegador/PWA acompaña en claro.
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Llena el área del notch/safe-area; nuestro CSS ya usa env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased" suppressHydrationWarning>
        {/* Aplica el tema antes de pintar para evitar el flash.
            Default = CLARO: agregamos la clase 'light' salvo que el usuario haya
            elegido 'dark' explícitamente. (La landing se fuerza oscura por CSS). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('theme')!=='dark'){document.documentElement.classList.add('light');}}catch(e){document.documentElement.classList.add('light');}})();",
          }}
        />
        <AppSplash />
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
        <SpeedInsights />
        <Toaster
          theme="light"
          richColors
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
