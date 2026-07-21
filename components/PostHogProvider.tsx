"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Se activa solo si hay key configurada (NEXT_PUBLIC_POSTHOG_KEY en Vercel).
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** Registra un pageview en cada navegación (App Router no lo hace solo). */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph || !pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!KEY || typeof window === "undefined") return;
    if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;
    posthog.init(KEY, {
      api_host: HOST,
      capture_pageview: false, // lo manejamos manualmente (App Router)
      capture_pageleave: true,
      // Autocapture DESACTIVADO: en una app de finanzas, los eventos automáticos
      // de click/change mandan el texto del elemento ($el_text) —montos, nombres
      // de cuentas/categorías— a un tercero. El enmascarado del session-replay NO
      // aplica al autocapture. Capturamos solo eventos explícitos y seguros.
      autocapture: false,
      mask_all_element_attributes: true,
      persistence: "localStorage+cookie",
      session_recording: {
        // Privacidad (app de finanzas con datos reales): enmascaramos TODO.
        // - maskAllInputs: nunca grabamos lo que se tipea (contraseñas, montos).
        // - maskTextSelector "*": tapamos también el texto ya en pantalla
        //   (saldos, movimientos, nombres de cuentas). Así vemos el COMPORTAMIENTO
        //   (clicks, dónde se traban, scroll) pero NUNCA los datos personales.
        maskAllInputs: true,
        maskTextSelector: "*",
      },
    });
  }, []);

  if (!KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
