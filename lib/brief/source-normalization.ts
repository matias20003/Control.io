import {
  BRIEF_PLATFORMS,
  type BriefPlatform,
} from "@/lib/brief/types";

export type NormalizedSocialSource = {
  platform: BriefPlatform;
  handle: string;
  profileUrl: string;
  normalizedKey: string;
};

const HANDLE_RE = /^[\p{L}\p{N}._-]{1,80}$/u;

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    url.protocol = "https:";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function platformFromHost(hostname: string): BriefPlatform | null {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host === "instagram.com") return "INSTAGRAM";
  if (host === "youtube.com" || host === "youtu.be") return "YOUTUBE";
  if (host === "tiktok.com") return "TIKTOK";
  if (host === "x.com" || host === "twitter.com") return "X";
  if (host === "linkedin.com") return "LINKEDIN";
  return "WEB";
}

function cleanHandle(platform: BriefPlatform, pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (platform === "LINKEDIN" && ["in", "company"].includes(parts[0] ?? "")) {
    return parts[1] ?? "";
  }
  if (platform === "YOUTUBE" && parts[0]?.toLowerCase() === "channel") {
    return parts[1] ?? "";
  }
  return (parts[0] ?? "").replace(/^@/, "");
}

function isContentPath(platform: BriefPlatform, pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (platform === "INSTAGRAM") {
    return ["p", "reel", "reels", "stories", "explore"].includes(first);
  }
  if (platform === "YOUTUBE") {
    return ["watch", "shorts", "playlist"].includes(first);
  }
  if (platform === "LINKEDIN") {
    return ["posts", "feed", "pulse"].includes(first);
  }
  return false;
}

function profileUrlFor(platform: BriefPlatform, handle: string): string {
  const encoded = encodeURIComponent(handle);
  switch (platform) {
    case "INSTAGRAM":
      return `https://www.instagram.com/${encoded}/`;
    case "YOUTUBE":
      return `https://www.youtube.com/@${encoded}`;
    case "TIKTOK":
      return `https://www.tiktok.com/@${encoded}`;
    case "X":
      return `https://x.com/${encoded}`;
    case "LINKEDIN":
      return `https://www.linkedin.com/in/${encoded}`;
    case "WEB":
      return handle;
  }
}

export function normalizeSocialSource(
  rawValue: string,
  selectedPlatform: string
): NormalizedSocialSource | null {
  const value = rawValue.trim();
  if (!value) return null;

  const selected = BRIEF_PLATFORMS.includes(selectedPlatform as BriefPlatform)
    ? (selectedPlatform as BriefPlatform)
    : null;
  if (!selected) return null;

  const candidate = /^(?:https?:)?\/\//i.test(value)
    ? value.replace(/^\/\//, "https://")
    : null;
  const parsed = candidate ? safeUrl(candidate) : null;

  if (parsed) {
    const detected = platformFromHost(parsed.hostname);
    const platform = detected === "WEB" ? selected : detected;
    if (!platform) return null;

    if (platform === "WEB") {
      const profileUrl = parsed.toString();
      return {
        platform,
        handle: parsed.hostname.replace(/^www\./, ""),
        profileUrl,
        normalizedKey: `web:${profileUrl.toLowerCase().replace(/\/$/, "")}`,
      };
    }

    if (isContentPath(platform, parsed.pathname)) return null;
    const handle = cleanHandle(platform, parsed.pathname);
    if (!HANDLE_RE.test(handle)) return null;
    const profileUrl =
      platform === "LINKEDIN" || platform === "YOUTUBE"
        ? `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "")
        : profileUrlFor(platform, handle);
    return {
      platform,
      handle,
      profileUrl,
      normalizedKey: `${platform.toLowerCase()}:${handle.toLowerCase()}`,
    };
  }

  if (selected === "WEB") return null;
  const handle = value.replace(/^@/, "").trim();
  if (!HANDLE_RE.test(handle)) return null;
  return {
    platform: selected,
    handle,
    profileUrl: profileUrlFor(selected, handle),
    normalizedKey: `${selected.toLowerCase()}:${handle.toLowerCase()}`,
  };
}

export function sourceTypeForCategory(category: string): string {
  if (category === "MEDIA") return "MEDIA";
  if (category === "COMPETITOR") return "ACCOUNT";
  return "PERSON";
}
