import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMediaAsDataUrl } from "@/lib/whatsapp/kapso";

describe("WhatsApp media redirects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KAPSO_API_KEY;
  });

  it("follows an allowed Kapso redirect to Meta without forwarding credentials", async () => {
    process.env.KAPSO_API_KEY = "secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://lookaside.fbsbx.com/media/receipt.jpg" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMediaAsDataUrl("https://api.kapso.ai/media/123", "image/jpeg");
    expect(result).toBe("data:image/jpeg;base64,AQID");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers["X-API-Key"]).toBe("secret");
    expect(fetchMock.mock.calls[1][1].headers["X-API-Key"]).toBeUndefined();
  });

  it("accepts Kapso's official Cloudflare R2 media bucket", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://kapso-ai-prod.d77f1e59818b5ed2ec009d1a9116b255.r2.cloudflarestorage.com/inbound/photo.jpg" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([4, 5]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchMediaAsDataUrl("https://api.kapso.ai/media/456")).resolves.toBe("data:image/jpeg;base64,BAU=");
  });

  it("rejects redirects outside the media allowlist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private" },
    })));
    await expect(fetchMediaAsDataUrl("https://api.kapso.ai/media/123")).rejects.toThrow("host no permitido");
  });
});
