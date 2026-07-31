"use client";

import { useEffect } from "react";

const FIELD_SELECTOR =
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']";

/**
 * Mantiene formularios y modales dentro del área realmente visible cuando el
 * teclado virtual reduce el viewport. `100dvh` no alcanza en todas las
 * combinaciones de iOS/PWA/Android, por eso usamos VisualViewport cuando está
 * disponible y dejamos CSS como fallback.
 */
export function MobileKeyboardManager() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(max-width: 767px)");

    const visibleViewport = () => ({
      height: viewport?.height ?? window.innerHeight,
      offsetTop: viewport?.offsetTop ?? 0,
    });

    const syncViewport = () => {
      const { height, offsetTop } = visibleViewport();
      root.style.setProperty("--visual-viewport-height", `${height}px`);
      root.style.setProperty("--visual-viewport-top", `${offsetTop}px`);

      const keyboardOpen = mobile.matches && window.innerHeight - height > 120;
      root.classList.toggle("mobile-keyboard-open", keyboardOpen);

      document.querySelectorAll<HTMLElement>("[data-keyboard-aware-modal]").forEach((modal) => {
        if (mobile.matches) {
          modal.style.top = `${offsetTop + height / 2}px`;
          modal.style.maxHeight = `${Math.max(240, height - 16)}px`;
        } else {
          modal.style.removeProperty("top");
          modal.style.removeProperty("max-height");
        }
      });
    };

    const revealField = (field: Element) => {
      if (!mobile.matches || !field.matches(FIELD_SELECTOR)) return;

      window.setTimeout(() => {
        const { height, offsetTop } = visibleViewport();
        const rect = field.getBoundingClientRect();
        const visibleTop = offsetTop + 12;
        const visibleBottom = offsetTop + height - 20;

        if (rect.top < visibleTop || rect.bottom > visibleBottom) {
          field.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 120);
    };

    const onFocusIn = (event: FocusEvent) => {
      syncViewport();
      if (event.target instanceof Element) revealField(event.target);
    };

    const onViewportChange = () => {
      syncViewport();
      if (document.activeElement instanceof Element) revealField(document.activeElement);
    };

    const observer = new MutationObserver(syncViewport);
    observer.observe(document.body, { childList: true, subtree: true });

    syncViewport();
    window.addEventListener("resize", onViewportChange);
    document.addEventListener("focusin", onFocusIn);
    viewport?.addEventListener("resize", onViewportChange);
    viewport?.addEventListener("scroll", onViewportChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onViewportChange);
      document.removeEventListener("focusin", onFocusIn);
      viewport?.removeEventListener("resize", onViewportChange);
      viewport?.removeEventListener("scroll", onViewportChange);
      root.classList.remove("mobile-keyboard-open");
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-top");
    };
  }, []);

  return null;
}
