"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Splash de lanzamiento "premium" para la PWA instalada.
 *
 * Las pantallas de carga nativas (Android/iOS) son ESTÁTICAS: muestran el ícono
 * sobre el `background_color` del manifest. Para el efecto animado, mostramos
 * este overlay apenas carga la app (solo en modo standalone, o sea instalada),
 * dibujamos la "c" de control.io sobre el MISMO azul del manifest (empalme sin
 * cortes con la pantalla nativa) y lo fundimos para revelar el dashboard.
 *
 * Se monta una sola vez por lanzamiento (la navegación interna de Next no
 * remonta el layout), así que no reaparece al cambiar de pantalla.
 */
export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setMounted(true);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!standalone) return; // En el navegador normal no mostramos splash.

    setShow(true);
    document.documentElement.style.setProperty("overflow", "hidden");

    const tLeave = setTimeout(() => setLeaving(true), 1400);
    const tDone = setTimeout(() => {
      setShow(false);
      document.documentElement.style.removeProperty("overflow");
    }, 1900);

    return () => {
      clearTimeout(tLeave);
      clearTimeout(tDone);
      document.documentElement.style.removeProperty("overflow");
    };
  }, []);

  if (!mounted || !show) return null;

  return createPortal(
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "#2563EB" }}
    >
      <svg width="96" height="96" viewBox="0 0 100 100" fill="none" role="img" aria-label="control.io">
        {/* "c" como arco abierto a la derecha; se traza con stroke-dashoffset */}
        <path
          d="M70 30 A28 28 0 1 0 70 70"
          stroke="white"
          strokeWidth="9"
          strokeLinecap="round"
          className="splash-c"
        />
      </svg>
      <span className="splash-word mt-5 text-lg font-semibold tracking-tight text-white">
        control.io
      </span>
    </div>,
    document.body,
  );
}
