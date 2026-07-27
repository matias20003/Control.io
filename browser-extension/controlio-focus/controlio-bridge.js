(function installControlIoBridge() {
  "use strict";

  const PAGE_SOURCE = "controlio-web";
  const EXTENSION_SOURCE = "controlio-focus-extension";
  const ALLOWED_TYPES = new Set([
    "CONTROLIO_FOCUS_CLOSE",
    "CONTROLIO_FOCUS_OPEN",
    "CONTROLIO_FOCUS_PING",
  ]);

  document.documentElement.dataset.controlioFocusBridge = "ready";

  function postToPage(type, payload) {
    window.postMessage(
      {
        source: EXTENSION_SOURCE,
        type,
        ...payload,
      },
      window.location.origin
    );
  }

  async function forwardToExtension(message) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      postToPage(`${message.type}_RESULT`, {
        correlationId: message.correlationId,
        ...response,
      });
    } catch {
      postToPage(`${message.type}_RESULT`, {
        correlationId: message.correlationId,
        error: "Control.io Focus no está disponible.",
        ok: false,
      });
    }
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data?.source !== PAGE_SOURCE ||
      !ALLOWED_TYPES.has(event.data?.type)
    ) {
      return;
    }

    if (
      event.data.type === "CONTROLIO_FOCUS_OPEN" &&
      document.documentElement.dataset.controlioFocusAuthorized !== "true"
    ) {
      postToPage("CONTROLIO_FOCUS_OPEN_RESULT", {
        correlationId: event.data.correlationId,
        error: "Esta función no está habilitada para este usuario.",
        ok: false,
      });
      return;
    }

    void forwardToExtension({
      correlationId: event.data.correlationId,
      durationSeconds: event.data.durationSeconds,
      handle: event.data.handle,
      type: event.data.type,
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CONTROLIO_FOCUS_SESSION_CLOSED") {
      postToPage(message.type, { reason: message.reason });
    }
  });

  void forwardToExtension({
    correlationId: "bridge-ready",
    type: "CONTROLIO_FOCUS_PING",
  });
})();
