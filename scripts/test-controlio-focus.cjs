"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const workspace = path.resolve(__dirname, "..");
const extensionPath = path.join(
  workspace,
  "browser-extension",
  "controlio-focus"
);

function findChromePath() {
  if (process.env.CONTROLIO_CHROME_PATH) {
    return process.env.CONTROLIO_CHROME_PATH;
  }

  const playwrightRoot = path.join(
    process.env.LOCALAPPDATA || "",
    "ms-playwright"
  );
  if (fs.existsSync(playwrightRoot)) {
    const chromiumDirectories = fs
      .readdirSync(playwrightRoot)
      .filter((entry) => entry.startsWith("chromium-"))
      .sort()
      .reverse();
    for (const directory of chromiumDirectories) {
      const candidate = path.join(
        playwrightRoot,
        directory,
        "chrome-win64",
        "chrome.exe"
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
}

const chromePath = findChromePath();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function readTargets(port, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chrome todavía está iniciando.
    }
    await delay(250);
  }
  throw new Error("Chrome no abrió el puerto de depuración.");
}

async function connectToTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    async evaluate(expression) {
      const id = nextId;
      nextId += 1;
      const result = await new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve });
        socket.send(
          JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: {
              awaitPromise: true,
              expression,
              returnByValue: true,
            },
          })
        );
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text ||
            "Falló Runtime.evaluate."
        );
      }
      return result.result?.value;
    },
    close() {
      socket.close();
    },
  };
}

async function main() {
  assert.equal(fs.existsSync(chromePath), true, `No existe Chrome en ${chromePath}`);
  assert.equal(fs.existsSync(extensionPath), true, "No existe la extensión.");

  const port = await getFreePort();
  const sitePort = await getFreePort();
  const localServer = http.createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      '<!doctype html><html data-controlio-focus-authorized="true"><title>Control.io Focus smoke test</title></html>'
    );
  });
  await new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(sitePort, "127.0.0.1", resolve);
  });
  const profilePath = fs.mkdtempSync(
    path.join(os.tmpdir(), "controlio-focus-smoke-")
  );
  const chrome = spawn(
    chromePath,
    [
      "--disable-default-apps",
      "--disable-extensions-except=" + extensionPath,
      "--disable-gpu",
      "--load-extension=" + extensionPath,
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      "--user-data-dir=" + profilePath,
      "--window-position=-32000,-32000",
      "--window-size=800,600",
      `http://127.0.0.1:${sitePort}/`,
    ],
    { stdio: "ignore", windowsHide: true }
  );

  try {
    let targets = await readTargets(port);
    await delay(1800);
    targets = await readTargets(port, 1);
    const controlIoTarget = targets.find(
      (target) =>
        target.type === "page" &&
        new URL(target.url).hostname === "127.0.0.1"
    );
    assert.ok(controlIoTarget, "No se encontró la pestaña de Control.io.");

    const controlIo = await connectToTarget(controlIoTarget);
    const bridgeMarker = await controlIo.evaluate(
      `document.documentElement.dataset.controlioFocusBridge || null`
    );
    assert.equal(
      bridgeMarker,
      "ready",
      "Chrome no inyectó el puente de la extensión."
    );
    const ping = await controlIo.evaluate(`
      new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ ok: false }), 2500);
        const listener = (event) => {
          if (
            event.data?.source === "controlio-focus-extension" &&
            event.data?.type === "CONTROLIO_FOCUS_PING_RESULT"
          ) {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve(event.data);
          }
        };
        window.addEventListener("message", listener);
        window.postMessage({
          source: "controlio-web",
          type: "CONTROLIO_FOCUS_PING",
          correlationId: "smoke-ping"
        }, window.location.origin);
      })
    `);
    assert.equal(ping.ok, true, "El puente de la extensión no respondió.");

    const opened = await controlIo.evaluate(`
      new Promise((resolve) => {
        const timeout = setTimeout(() => resolve({ ok: false }), 3500);
        const listener = (event) => {
          if (
            event.data?.source === "controlio-focus-extension" &&
            event.data?.type === "CONTROLIO_FOCUS_OPEN_RESULT" &&
            event.data?.correlationId === "smoke-open"
          ) {
            clearTimeout(timeout);
            window.removeEventListener("message", listener);
            resolve(event.data);
          }
        };
        window.addEventListener("message", listener);
        window.postMessage({
          source: "controlio-web",
          type: "CONTROLIO_FOCUS_OPEN",
          correlationId: "smoke-open",
          durationSeconds: 12,
          handle: "francopisso"
        }, window.location.origin);
      })
    `);
    assert.equal(opened.ok, true, opened.error || "No se abrió el modo enfocado.");

    await delay(1800);
    targets = await readTargets(port, 1);
    const instagramTarget = targets.find(
      (target) =>
        target.type === "page" &&
        target.url.includes("instagram.com/francopisso")
    );
    assert.ok(instagramTarget, "No se abrió el perfil autorizado.");

    const instagram = await connectToTarget(instagramTarget);
    const focusBarExists = await instagram.evaluate(
      `Boolean(document.getElementById("controlio-focus-bar"))`
    );
    assert.equal(focusBarExists, true, "No se activó la capa enfocada.");

    await instagram.evaluate(`
      (() => {
        const anchor = document.createElement("a");
        anchor.href = "https://www.instagram.com/reel/CONTROLIO_PROFILE_REEL_123/";
        anchor.textContent = "Reel del perfil elegido";
        document.body.append(anchor);
      })()
    `);
    await delay(700);
    targets = await readTargets(port, 1);
    const workerTarget = targets.find(
      (target) =>
        target.type === "service_worker" &&
        target.url.endsWith("/service-worker.js")
    );
    assert.ok(workerTarget, "No se encontró el service worker de la extensión.");
    const worker = await connectToTarget(workerTarget);
    const registeredPaths = await worker.evaluate(`
      chrome.storage.session.get("activeFocusSession").then(
        (stored) => stored.activeFocusSession?.allowedContentPaths || []
      )
    `);
    worker.close();
    assert.equal(
      registeredPaths.includes("/reel/CONTROLIO_PROFILE_REEL_123"),
      true,
      "La extensión no registró el reel visible del perfil elegido."
    );
    await instagram.evaluate(`
      history.pushState(
        {},
        "",
        "/reel/CONTROLIO_PROFILE_REEL_123/"
      )
    `);
    await delay(900);
    targets = await readTargets(port, 1);
    assert.equal(
      targets.some(
        (target) =>
          target.type === "page" &&
          target.url.includes("/reel/CONTROLIO_PROFILE_REEL_123/")
      ),
      true,
      "La extensión bloqueó un reel registrado desde el perfil elegido."
    );

    await instagram.evaluate(
      `window.location.href = "https://www.instagram.com/instagram/"`
    );
    instagram.close();

    await delay(2000);
    targets = await readTargets(port, 1);
    assert.equal(
      targets.some(
        (target) =>
          target.type === "page" &&
          target.url.includes("instagram.com/francopisso")
      ),
      true,
      "La extensión permitió salir del perfil autorizado."
    );

    await delay(8000);
    targets = await readTargets(port, 1);
    assert.equal(
      targets.some(
        (target) =>
          target.type === "page" && target.url.includes("instagram.com/")
      ),
      false,
      "La ventana de Instagram no se cerró al vencer el tiempo."
    );

    controlIo.close();
    console.log("Control.io Focus Chrome smoke test passed.");
  } finally {
    const chromeExited = new Promise((resolve) => {
      if (chrome.exitCode !== null) resolve();
      else chrome.once("exit", resolve);
    });
    chrome.kill();
    await Promise.race([chromeExited, delay(3000)]);
    await new Promise((resolve) => localServer.close(resolve));
    const resolvedProfile = path.resolve(profilePath);
    const resolvedTemp = path.resolve(os.tmpdir());
    if (
      resolvedProfile.startsWith(resolvedTemp + path.sep) &&
      path.basename(resolvedProfile).startsWith("controlio-focus-smoke-")
    ) {
      try {
        fs.rmSync(resolvedProfile, {
          force: true,
          maxRetries: 10,
          recursive: true,
          retryDelay: 200,
        });
      } catch (error) {
        console.warn(`No se pudo limpiar ${resolvedProfile}: ${error.message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
