import { describe, expect, it } from "vitest";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

describe("crypto (AES-256-GCM field encryption)", () => {
  it("roundtrip: decrypt(encrypt(x)) === x", () => {
    const v = "gasté 5 lucas en el súper 🛒";
    const enc = encrypt(v)!;
    expect(enc.startsWith("enc:")).toBe(true);
    expect(decrypt(enc)).toBe(v);
  });

  it("cada cifrado es único (IV aleatorio)", () => {
    expect(encrypt("hola")).not.toBe(encrypt("hola"));
  });

  it("decrypt deja pasar texto plano (filas pre-migración)", () => {
    expect(decrypt("texto plano sin prefijo")).toBe("texto plano sin prefijo");
  });

  it("isEncrypted detecta el prefijo enc:", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("x")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("null / vacío se manejan sin romper", () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(encrypt("")).toBe(""); // vacío pasa como vacío (no se cifra)
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeNull();
    expect(decrypt("")).toBe("");
  });

  it("dato manipulado devuelve null (no basura)", () => {
    const enc = encrypt("secreto bancario")!;
    const tampered = enc.slice(0, -2) + (enc.endsWith("AA") ? "BB" : "AA");
    expect(decrypt(tampered)).toBeNull();
  });
});
