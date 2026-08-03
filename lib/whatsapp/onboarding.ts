export type WhatsappLinkStatus = "linked" | "unlinked" | "unknown";

/** Solo una confirmación explícita de "no vinculado" habilita el banner. */
export function shouldShowWhatsappOnboarding(
  featureEnabled: boolean,
  linkStatus: WhatsappLinkStatus,
): boolean {
  return featureEnabled && linkStatus === "unlinked";
}
