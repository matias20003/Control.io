(function registerControlIoFocusPolicy(root, factory) {
  const policy = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = policy;
  }

  root.ControlIoFocusPolicy = policy;
})(typeof globalThis === "undefined" ? self : globalThis, function createPolicy() {
  "use strict";

  const RESERVED_ROOTS = new Set([
    "about",
    "accounts",
    "challenge",
    "create",
    "developer",
    "direct",
    "emails",
    "explore",
    "legal",
    "oauth",
    "p",
    "reel",
    "reels",
    "static",
    "stories",
    "tv",
    "web",
  ]);

  const BLOCKED_ROOTS = new Set([
    "",
    "create",
    "direct",
    "explore",
    "reels",
  ]);

  function normalizeHandle(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();

    return /^[a-z0-9._]{1,30}$/.test(normalized) ? normalized : null;
  }

  function parseInstagramUrl(value) {
    try {
      const url = new URL(value, "https://www.instagram.com");
      const hostname = url.hostname.toLowerCase();
      if (hostname !== "instagram.com" && hostname !== "www.instagram.com") {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }

  function pathSegments(pathname) {
    return pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  function canonicalPath(url) {
    const normalized = url.pathname.replace(/\/+$/, "");
    return normalized || "/";
  }

  function contentPathFromUrl(value) {
    const url = parseInstagramUrl(value);
    if (!url) return null;

    const segments = pathSegments(url.pathname);
    if (
      segments.length >= 2 &&
      ["p", "reel", "tv"].includes(segments[0]) &&
      /^[a-zA-Z0-9_-]+$/.test(segments[1])
    ) {
      return `/${segments[0]}/${segments[1]}`;
    }

    return null;
  }

  function profileHandleFromUrl(value) {
    const url = parseInstagramUrl(value);
    if (!url) return null;

    const segments = pathSegments(url.pathname);
    if (segments.length !== 1) return null;

    const candidate = normalizeHandle(segments[0]);
    if (!candidate || RESERVED_ROOTS.has(candidate)) return null;
    return candidate;
  }

  function isOwnStory(url, handle) {
    const segments = pathSegments(url.pathname);
    return (
      segments[0] === "stories" &&
      normalizeHandle(segments[1]) === normalizeHandle(handle)
    );
  }

  function isOwnProfileNavigation(url, handle) {
    const segments = pathSegments(url.pathname);
    const normalizedHandle = normalizeHandle(handle);
    return (
      normalizeHandle(segments[0]) === normalizedHandle &&
      (segments.length === 1 ||
        (segments.length === 2 && segments[1] === "reels"))
    );
  }

  function isLoginFlow(url) {
    const segments = pathSegments(url.pathname);
    return (
      segments[0] === "accounts" &&
      ["login", "onetap"].includes(segments[1] || "")
    );
  }

  function isAllowedNavigation(value, handle, allowedContentPaths) {
    const normalizedHandle = normalizeHandle(handle);
    const url = parseInstagramUrl(value);
    if (!normalizedHandle || !url) return false;

    if (isOwnProfileNavigation(url, normalizedHandle)) return true;
    if (isOwnStory(url, normalizedHandle)) return true;
    if (isLoginFlow(url)) return true;

    const contentPath = contentPathFromUrl(url.href);
    return Boolean(
      contentPath && new Set(allowedContentPaths || []).has(contentPath)
    );
  }

  function classifyLink(value, handle, allowedContentPaths) {
    const normalizedHandle = normalizeHandle(handle);
    const url = parseInstagramUrl(value);
    if (!normalizedHandle || !url) return "block";

    if (isOwnProfileNavigation(url, normalizedHandle)) return "allow";
    if (isOwnStory(url, normalizedHandle)) return "allow";
    if (isLoginFlow(url)) return "allow";

    const contentPath = contentPathFromUrl(url.href);
    if (contentPath) {
      return new Set(allowedContentPaths || []).has(contentPath)
        ? "allow"
        : "allow-content";
    }

    const segments = pathSegments(url.pathname);
    if (BLOCKED_ROOTS.has(segments[0] || "")) return "block";
    if (profileHandleFromUrl(url.href)) return "block";
    return "block";
  }

  return Object.freeze({
    classifyLink,
    contentPathFromUrl,
    isAllowedNavigation,
    isOwnProfileNavigation,
    normalizeHandle,
    parseInstagramUrl,
    profileHandleFromUrl,
  });
});
