"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, Plus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Detecta instalabilidad de la PWA y expone el prompt nativo / instrucciones iOS. */
export function useInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    const onBIP = (e: Event) => {
      e.preventDefault(); // guardamos el evento para dispararlo nosotros
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  };

  // Podemos ofrecer instalación si: no está instalada y (hay prompt nativo o es iOS).
  const canInstall = ready && !installed && (deferred !== null || isIOS);
  return { ready, installed, isIOS, canInstall, hasNativePrompt: deferred !== null, promptInstall };
}

/* ── Modal de instrucciones para iOS (no soporta prompt nativo) ── */
function IOSInstructions({ onClose }: { onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Instalar en iPhone</p>
          <button aria-label="Cerrar" onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-muted">
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
            <span>Tocá <Share size={14} className="inline align-text-bottom text-primary" /> <b className="text-foreground">Compartir</b> en la barra de Safari.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
            <span>Elegí <Plus size={14} className="inline align-text-bottom text-primary" /> <b className="text-foreground">Agregar a inicio</b>.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
            <span>Confirmá y listo: el ícono queda en tu pantalla. 🎉</span>
          </li>
        </ol>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Botón de instalación adaptable:
 * - Android/Chrome → dispara el prompt nativo.
 * - iOS/Safari → abre instrucciones.
 * - No instalable (ya instalada o desktop sin soporte) → no renderiza nada.
 */
export function InstallButton({ className, label = "Instalar app" }: { className?: string; label?: string }) {
  const { canInstall, hasNativePrompt, isIOS, promptInstall } = useInstall();
  const [showIOS, setShowIOS] = useState(false);

  if (!canInstall) return null;

  const onClick = () => {
    if (hasNativePrompt) void promptInstall();
    else if (isIOS) setShowIOS(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        }
      >
        <Download size={17} />
        {label}
      </button>
      {showIOS && <IOSInstructions onClose={() => setShowIOS(false)} />}
    </>
  );
}

const DISMISS_KEY = "install-banner-dismissed";

/** Banner discreto dentro de la app para usuarios que todavía no la instalaron. */
export function InstallBanner() {
  const { canInstall, hasNativePrompt, isIOS, promptInstall } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!canInstall || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const onInstall = () => {
    if (hasNativePrompt) {
      void promptInstall().then((r) => {
        if (r === "accepted") close();
      });
    } else if (isIOS) {
      setShowIOS(true);
    }
  };

  return (
    <>
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5 md:mx-6">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Download size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground leading-tight">Instalá control.io en tu teléfono</p>
          <p className="text-[11px] text-muted leading-tight">Acceso directo desde tu pantalla de inicio, como una app.</p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Instalar
        </button>
        <button aria-label="Descartar" onClick={close} className="shrink-0 p-1 rounded-md text-muted hover:text-foreground">
          <X size={15} />
        </button>
      </div>
      {showIOS && <IOSInstructions onClose={() => setShowIOS(false)} />}
    </>
  );
}
