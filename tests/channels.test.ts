import { describe, expect, it } from "vitest";
import { isPublicHttpUrl, normalizeInputUrl } from "@/lib/services/brief/channels";

describe("normalizeInputUrl", () => {
  it("le pone el esquema a lo que la gente escribe de memoria", () => {
    expect(normalizeInputUrl("ejemplo.com/blog")).toBe("https://ejemplo.com/blog");
  });

  it("respeta la URL cuando ya viene completa", () => {
    expect(normalizeInputUrl("http://ejemplo.com/")).toBe("http://ejemplo.com/");
  });

  it("rechaza lo que no puede ser un dominio", () => {
    expect(normalizeInputUrl("no es una url")).toBeNull();
    expect(normalizeInputUrl("localhost")).toBeNull();
    expect(normalizeInputUrl("")).toBeNull();
  });
});

describe("isPublicHttpUrl · corta el SSRF", () => {
  it("deja pasar direcciones publicas normales", () => {
    expect(isPublicHttpUrl("https://ejemplo.com/feed")).toBe(true);
    expect(isPublicHttpUrl("http://blog.ejemplo.com.ar/rss")).toBe(true);
  });

  it("bloquea localhost y dominios internos", () => {
    expect(isPublicHttpUrl("http://localhost:3000/x")).toBe(false);
    expect(isPublicHttpUrl("http://app.localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://db.internal/x")).toBe(false);
  });

  it("bloquea los rangos privados de IPv4", () => {
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.31.255.255/x")).toBe(false);
    expect(isPublicHttpUrl("http://0.0.0.0/x")).toBe(false);
  });

  it("bloquea la IP de metadatos de la nube", () => {
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("deja pasar IPv4 publicas que se parecen a las privadas", () => {
    expect(isPublicHttpUrl("http://172.32.0.1/x")).toBe(true);
    expect(isPublicHttpUrl("http://11.0.0.1/x")).toBe(true);
  });

  it("bloquea loopback y link-local de IPv6", () => {
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
    expect(isPublicHttpUrl("http://[fe80::1]/x")).toBe(false);
    expect(isPublicHttpUrl("http://[fd00::1]/x")).toBe(false);
  });

  it("rechaza esquemas que no son http", () => {
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("gopher://a.com")).toBe(false);
  });
});
