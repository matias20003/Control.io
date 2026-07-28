import { describe, expect, it } from "vitest";
import {
  normalizeSocialSource,
  sourceTypeForCategory,
} from "@/lib/brief/source-normalization";

describe("normalizeSocialSource", () => {
  it("normaliza handles de Instagram sin depender de una extensión", () => {
    expect(normalizeSocialSource("@francopisso", "INSTAGRAM")).toEqual({
      platform: "INSTAGRAM",
      handle: "francopisso",
      profileUrl: "https://www.instagram.com/francopisso/",
      normalizedKey: "instagram:francopisso",
    });
  });

  it("detecta la plataforma desde una URL y elimina query strings", () => {
    expect(
      normalizeSocialSource(
        "https://www.tiktok.com/@arquitectura?lang=es",
        "INSTAGRAM"
      )
    ).toEqual({
      platform: "TIKTOK",
      handle: "arquitectura",
      profileUrl: "https://www.tiktok.com/@arquitectura",
      normalizedKey: "tiktok:arquitectura",
    });
  });

  it("conserva las rutas de canales y empresas", () => {
    expect(
      normalizeSocialSource(
        "https://www.linkedin.com/company/control-io/",
        "LINKEDIN"
      )?.profileUrl
    ).toBe("https://www.linkedin.com/company/control-io");
  });

  it("rechaza URLs de publicaciones cuando se espera una fuente", () => {
    expect(
      normalizeSocialSource(
        "https://www.instagram.com/reel/abc123/",
        "INSTAGRAM"
      )
    ).toBeNull();
  });

  it("rechaza protocolos inseguros y handles inválidos", () => {
    expect(normalizeSocialSource("javascript:alert(1)", "WEB")).toBeNull();
    expect(normalizeSocialSource("usuario con espacios", "X")).toBeNull();
  });

  it("clasifica la fuente sin guardar categorías duplicadas", () => {
    expect(sourceTypeForCategory("MEDIA")).toBe("MEDIA");
    expect(sourceTypeForCategory("COMPETITOR")).toBe("ACCOUNT");
    expect(sourceTypeForCategory("CLOSE")).toBe("PERSON");
  });
});
