(function installInstagramFocusMode() {
  "use strict";

  const policy = globalThis.ControlIoFocusPolicy;
  if (!policy) return;

  let session = null;
  let timerId = null;
  let observer = null;
  let restrictionsScheduled = false;
  let registrationInFlight = false;

  function sendMessage(message) {
    return chrome.runtime.sendMessage(message).catch(() => ({
      error: "La sesión enfocada ya no está disponible.",
      ok: false,
    }));
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function showNotice(text) {
    const notice = document.getElementById("controlio-focus-notice");
    if (!notice) return;

    notice.textContent = text;
    notice.classList.add("controlio-focus-notice-visible");
    window.setTimeout(() => {
      notice.classList.remove("controlio-focus-notice-visible");
    }, 2200);
  }

  function createFocusBar() {
    if (!document.body || document.getElementById("controlio-focus-bar")) return;

    const bar = document.createElement("aside");
    bar.id = "controlio-focus-bar";
    bar.setAttribute("aria-label", "Sesión enfocada de Control.io");

    const identity = document.createElement("div");
    identity.className = "controlio-focus-identity";
    identity.innerHTML = `
      <span class="controlio-focus-shield" aria-hidden="true">✓</span>
      <span>
        <strong>Control.io Focus</strong>
        <small>Solo @${session.handle}</small>
      </span>
    `;

    const actions = document.createElement("div");
    actions.className = "controlio-focus-actions";

    const timer = document.createElement("output");
    timer.id = "controlio-focus-timer";
    timer.setAttribute("aria-live", "polite");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Cerrar";
    closeButton.addEventListener("click", () => {
      void sendMessage({ type: "CONTROLIO_FOCUS_CLOSE_SELF" });
    });

    actions.append(timer, closeButton);
    bar.append(identity, actions);

    const notice = document.createElement("div");
    notice.id = "controlio-focus-notice";
    notice.setAttribute("role", "status");

    document.body.prepend(bar);
    document.body.append(notice);
  }

  function updateTimer() {
    const remaining = session.expiresAt - Date.now();
    const timer = document.getElementById("controlio-focus-timer");
    if (timer) timer.textContent = formatTime(remaining);

    if (remaining <= 0) {
      window.clearInterval(timerId);
      void sendMessage({ type: "CONTROLIO_FOCUS_CLOSE_SELF" });
    }
  }

  function isBlockedControl(element) {
    const control = element.closest(
      'button, [role="button"], [aria-label], [title]'
    );
    if (!control) return false;

    const label = [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();

    return [
      "buscar",
      "búsqueda",
      "create",
      "crear",
      "explorar",
      "explore",
      "messages",
      "mensajes",
      "more",
      "más",
      "notifications",
      "notificaciones",
      "search",
    ].some((blockedLabel) => label === blockedLabel);
  }

  function shouldHideLink(anchor) {
    try {
      const url = policy.parseInstagramUrl(anchor.href);
      if (!url) return false;

      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      return (
        pathname === "/" ||
        pathname === "/create" ||
        pathname.startsWith("/direct") ||
        pathname.startsWith("/explore") ||
        pathname === "/reels"
      );
    } catch {
      return false;
    }
  }

  function registerVisibleProfileContent() {
    const currentUrl = policy.parseInstagramUrl(window.location.href);
    const sourceIsOwnProfile = Boolean(
      currentUrl &&
        policy.isOwnProfileNavigation(currentUrl, session.handle)
    );
    if (registrationInFlight || !sourceIsOwnProfile) {
      return;
    }

    const knownPaths = new Set(session.allowedContentPaths);
    const urls = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => anchor.href)
      .filter((url) => {
        const path = policy.contentPathFromUrl(url);
        return path && !knownPaths.has(path);
      })
      .slice(0, 120);

    if (urls.length === 0) return;

    registrationInFlight = true;
    void sendMessage({
      type: "CONTROLIO_FOCUS_REGISTER_PROFILE_CONTENT",
      urls,
    }).then((response) => {
      registrationInFlight = false;
      if (response.ok && Array.isArray(response.allowedContentPaths)) {
        session.allowedContentPaths = response.allowedContentPaths;
        scheduleRestrictions();
      }
    });
  }

  function applyRestrictions() {
    restrictionsScheduled = false;
    if (!session) return;

    registerVisibleProfileContent();

    document.querySelectorAll("a[href]").forEach((anchor) => {
      anchor.classList.toggle(
        "controlio-focus-hidden-link",
        shouldHideLink(anchor)
      );
    });

    document
      .querySelectorAll('button, [role="button"], [aria-label], [title]')
      .forEach((element) => {
        element.classList.toggle(
          "controlio-focus-hidden-control",
          isBlockedControl(element)
        );
      });
  }

  function scheduleRestrictions() {
    if (restrictionsScheduled) return;
    restrictionsScheduled = true;
    queueMicrotask(applyRestrictions);
  }

  function handleClick(event) {
    if (!session || !(event.target instanceof Element)) return;

    const anchor = event.target.closest("a[href]");
    if (!anchor) {
      if (isBlockedControl(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showNotice("Esa opción está bloqueada durante tu sesión enfocada.");
      }
      return;
    }

    const destinationUrl = anchor.href;
    const classification = policy.classifyLink(
      destinationUrl,
      session.handle,
      session.allowedContentPaths
    );

    if (classification === "allow") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (classification === "allow-content") {
      void sendMessage({
        type: "CONTROLIO_FOCUS_ALLOW_CONTENT",
        url: destinationUrl,
      }).then((response) => {
        if (response.ok && Array.isArray(response.allowedContentPaths)) {
          session.allowedContentPaths = response.allowedContentPaths;
        } else {
          showNotice(response.error || "No se pudo abrir esa publicación.");
        }
      });
      return;
    }

    showNotice(`Durante estos 2 minutos solo podés navegar por @${session.handle}.`);
  }

  async function start() {
    const response = await sendMessage({
      type: "CONTROLIO_FOCUS_GET_SESSION",
    });
    if (!response.ok || !response.session) return;

    session = response.session;
    document.documentElement.classList.add("controlio-focus-active");

    if (document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      });
    }

    createFocusBar();
    updateTimer();
    timerId = window.setInterval(updateTimer, 250);

    document.addEventListener("click", handleClick, true);
    observer = new MutationObserver(scheduleRestrictions);
    observer.observe(document.body, { childList: true, subtree: true });
    applyRestrictions();
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CONTROLIO_FOCUS_NAVIGATION_BLOCKED") {
      showNotice(`Volvimos a @${session?.handle || "tu perfil elegido"}.`);
    }
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(timerId);
    observer?.disconnect();
  });

  void start();
})();
