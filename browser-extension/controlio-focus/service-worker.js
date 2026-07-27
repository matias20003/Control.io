"use strict";

importScripts("focus-policy.js");

const {
  contentOwnerHandleFromUrl,
  contentPathFromUrl,
  isAllowedNavigation,
  isOwnProfileNavigation,
  normalizeHandle,
  parseInstagramUrl,
} = ControlIoFocusPolicy;

const SESSION_KEY = "activeFocusSession";
const EXPIRE_ALARM = "controlio-focus-expire";
const MAX_ALLOWED_CONTENT_PATHS = 120;
const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const CONTROLIO_HOSTS = new Set([
  "controlio.site",
  "www.controlio.site",
  "control-io.vercel.app",
  "localhost",
  "127.0.0.1",
]);

function isControlIoSender(sender) {
  try {
    const url = new URL(sender.url || "");
    return (
      CONTROLIO_HOSTS.has(url.hostname) &&
      (url.protocol === "https:" ||
        (["localhost", "127.0.0.1"].includes(url.hostname) &&
          url.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

async function getSession() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return stored[SESSION_KEY] || null;
}

async function saveSession(session) {
  await chrome.storage.session.set({ [SESSION_KEY]: session });
}

async function notifyControlIo(message) {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => {
        try {
          return CONTROLIO_HOSTS.has(new URL(tab.url || "").hostname);
        } catch {
          return false;
        }
      })
      .map((tab) => chrome.tabs.sendMessage(tab.id, message))
  );
}

async function clearSession(reason, closeWindow) {
  const session = await getSession();
  await chrome.alarms.clear(EXPIRE_ALARM);
  await chrome.storage.session.remove(SESSION_KEY);

  if (closeWindow && session?.windowId) {
    await chrome.windows.remove(session.windowId).catch(() => undefined);
  }

  if (session) {
    await notifyControlIo({
      type: "CONTROLIO_FOCUS_SESSION_CLOSED",
      reason,
    });
  }
}

async function openSession(message) {
  const handle = normalizeHandle(message.handle);
  if (!handle) throw new Error("El usuario de Instagram no es válido.");

  const existingSession = await getSession();
  if (
    existingSession?.handle === handle &&
    Date.now() < existingSession.expiresAt
  ) {
    await chrome.windows.update(existingSession.windowId, { focused: true });
    return existingSession;
  }

  const requestedDuration = Math.floor(Number(message.durationSeconds));
  const durationSeconds = Math.min(
    120,
    Math.max(1, Number.isFinite(requestedDuration) ? requestedDuration : 120)
  );

  await clearSession("replaced", true);

  const focusWindow = await chrome.windows.create({
    focused: true,
    height: 760,
    type: "popup",
    url: chrome.runtime.getURL("launching.html"),
    width: 500,
  });

  if (!focusWindow?.id) {
    throw new Error("Chrome no pudo crear la ventana enfocada.");
  }

  const tabs =
    focusWindow.tabs?.length > 0
      ? focusWindow.tabs
      : await chrome.tabs.query({ windowId: focusWindow.id });
  const focusTab = tabs[0];

  if (!focusTab?.id) {
    await chrome.windows.remove(focusWindow.id).catch(() => undefined);
    throw new Error("Chrome no pudo preparar la pestaña enfocada.");
  }

  const expiresAt = Date.now() + durationSeconds * 1000;
  const session = {
    allowedContentPaths: [],
    expiresAt,
    handle,
    tabId: focusTab.id,
    windowId: focusWindow.id,
  };

  await saveSession(session);
  await chrome.alarms.create(EXPIRE_ALARM, { when: expiresAt });
  await chrome.tabs.update(focusTab.id, {
    url: `https://www.instagram.com/${handle}/`,
  });

  return session;
}

async function getPublicSession(sender) {
  const session = await getSession();
  if (!session || sender.tab?.id !== session.tabId) return null;

  if (Date.now() >= session.expiresAt) {
    await clearSession("expired", true);
    return null;
  }

  return {
    allowedContentPaths: session.allowedContentPaths,
    expiresAt: session.expiresAt,
    handle: session.handle,
  };
}

async function addAllowedContentPaths(session, paths) {
  const allowedContentPaths = Array.from(
    new Set([...session.allowedContentPaths, ...paths])
  ).slice(-MAX_ALLOWED_CONTENT_PATHS);
  await saveSession({ ...session, allowedContentPaths });
  return allowedContentPaths;
}

async function registerProfileContent(message, sender) {
  const session = await getSession();
  if (!session || sender.tab?.id !== session.tabId) {
    throw new Error("La sesión enfocada ya no está activa.");
  }

  const sourceUrl = parseInstagramUrl(sender.url || "");
  if (!sourceUrl || !isOwnProfileNavigation(sourceUrl, session.handle)) {
    throw new Error("Solo se puede preparar contenido desde el perfil elegido.");
  }

  const paths = (Array.isArray(message.urls) ? message.urls : [])
    .slice(0, MAX_ALLOWED_CONTENT_PATHS)
    .flatMap((value) => {
      const contentPath = contentPathFromUrl(value);
      const contentOwner = contentOwnerHandleFromUrl(value);
      if (
        !contentPath ||
        (contentOwner && contentOwner !== session.handle)
      ) {
        return [];
      }
      return [contentPath];
    });

  return {
    allowedContentPaths: await addAllowedContentPaths(session, paths),
  };
}

async function allowContentAndNavigate(message, sender) {
  const session = await getSession();
  if (!session || sender.tab?.id !== session.tabId) {
    throw new Error("La sesión enfocada ya no está activa.");
  }

  const sourceUrl = parseInstagramUrl(sender.url || "");
  if (!sourceUrl || !isOwnProfileNavigation(sourceUrl, session.handle)) {
    throw new Error("Solo podés abrir publicaciones desde el perfil elegido.");
  }

  const contentPath = contentPathFromUrl(message.url);
  if (!contentPath) throw new Error("Ese destino no pertenece a una publicación.");
  const contentOwner = contentOwnerHandleFromUrl(message.url);
  if (contentOwner && contentOwner !== session.handle) {
    throw new Error("Esa publicación pertenece a otro perfil.");
  }

  const allowedContentPaths = await addAllowedContentPaths(session, [
    contentPath,
  ]);
  await chrome.tabs.update(session.tabId, { url: message.url });
  return { allowedContentPaths };
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "CONTROLIO_FOCUS_PING":
      if (!isControlIoSender(sender)) {
        throw new Error("Origen no autorizado.");
      }
      return { ok: true, version: EXTENSION_VERSION };

    case "CONTROLIO_FOCUS_OPEN":
      if (!isControlIoSender(sender)) {
        throw new Error("Origen no autorizado.");
      }
      await openSession(message);
      return { ok: true };

    case "CONTROLIO_FOCUS_CLOSE":
      if (!isControlIoSender(sender)) {
        throw new Error("Origen no autorizado.");
      }
      await clearSession("closed-from-controlio", true);
      return { ok: true };

    case "CONTROLIO_FOCUS_GET_SESSION": {
      const session = await getPublicSession(sender);
      return { ok: Boolean(session), session };
    }

    case "CONTROLIO_FOCUS_ALLOW_CONTENT":
      return {
        ok: true,
        ...(await allowContentAndNavigate(message, sender)),
      };

    case "CONTROLIO_FOCUS_REGISTER_PROFILE_CONTENT":
      return {
        ok: true,
        ...(await registerProfileContent(message, sender)),
      };

    case "CONTROLIO_FOCUS_CLOSE_SELF": {
      const session = await getSession();
      if (!session || sender.tab?.id !== session.tabId) {
        throw new Error("La sesión enfocada ya no está activa.");
      }
      await clearSession("closed-from-instagram", true);
      return { ok: true };
    }

    default:
      throw new Error("Mensaje no reconocido.");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        error: error instanceof Error ? error.message : "Error inesperado.",
        ok: false,
      })
    );
  return true;
});

async function enforceNavigation(details) {
  if (details.frameId !== 0) return;

  const session = await getSession();
  if (!session || details.tabId !== session.tabId) return;

  if (Date.now() >= session.expiresAt) {
    await clearSession("expired", true);
    return;
  }

  if (
    isAllowedNavigation(
      details.url,
      session.handle,
      session.allowedContentPaths
    )
  ) {
    return;
  }

  await chrome.tabs.update(session.tabId, {
    url: `https://www.instagram.com/${session.handle}/`,
  });
  await chrome.tabs
    .sendMessage(session.tabId, {
      type: "CONTROLIO_FOCUS_NAVIGATION_BLOCKED",
    })
    .catch(() => undefined);
}

chrome.webNavigation.onCommitted.addListener((details) => {
  void enforceNavigation(details);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  void enforceNavigation(details);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EXPIRE_ALARM) {
    void clearSession("expired", true);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  void getSession().then((session) => {
    if (session?.windowId === windowId) {
      return clearSession("window-closed", false);
    }
    return undefined;
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void getSession().then((session) => {
    if (session?.tabId === tabId) {
      return clearSession("tab-closed", false);
    }
    return undefined;
  });
});
