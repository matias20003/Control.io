import { describe, expect, it } from "vitest";
import { shouldShowWhatsappOnboarding } from "@/lib/whatsapp/onboarding";

describe("WhatsApp onboarding banner", () => {
  it("stays hidden for linked users, including testers", () => {
    expect(shouldShowWhatsappOnboarding(true, "linked")).toBe(false);
  });

  it("shows only when enabled and unlinked", () => {
    expect(shouldShowWhatsappOnboarding(true, "unlinked")).toBe(true);
    expect(shouldShowWhatsappOnboarding(false, "unlinked")).toBe(false);
  });

  it("stays hidden when the database status cannot be confirmed", () => {
    expect(shouldShowWhatsappOnboarding(true, "unknown")).toBe(false);
  });
});
