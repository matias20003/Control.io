import { describe, expect, it } from "vitest";
import { parseDevice } from "@/lib/device-session";

describe("parseDevice", () => {
  it("identifies Chrome on Windows desktop", () => {
    expect(parseDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0")).toEqual({
      deviceType: "Computadora",
      browser: "Chrome",
      os: "Windows",
    });
  });

  it("identifies Safari on iPhone", () => {
    expect(parseDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile Safari/604.1")).toEqual({
      deviceType: "Celular",
      browser: "Safari",
      os: "iOS",
    });
  });
});
