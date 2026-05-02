"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import {
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
  regenerateRecoveryCodes,
} from "@/lib/db/mfa";

type EnrollResult =
  | { error: string }
  | { factorId: string; qrCode: string; secret: string };

/**
 * Starts TOTP enrollment for the current user. Returns QR + secret to display once.
 * The factor stays "unverified" until verifyEnrollmentAction succeeds.
 */
export async function enrollTotpAction(): Promise<EnrollResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Limpiamos factores TOTP previos no verificados (de intentos abortados)
  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const stale = factorsList?.all?.filter(
    (f) => f.factor_type === "totp" && f.status === "unverified"
  ) ?? [];
  for (const f of stale) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `control.io · ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { error: error?.message ?? "No se pudo iniciar la activación" };

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/**
 * Verifies the 6-digit TOTP code against the just-enrolled factor.
 * On success, generates 8 fresh recovery codes (replacing any old ones).
 */
export async function verifyEnrollmentAction(
  factorId: string,
  code: string
): Promise<{ error?: string; recoveryCodes?: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const cleanCode = code.replace(/\D/g, "");
  if (cleanCode.length !== 6) return { error: "Ingresá los 6 dígitos" };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { error: "No se pudo generar el desafío. Volvé a intentar." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleanCode,
  });
  if (verifyError) return { error: "Código incorrecto. Probá con el más reciente de tu app." };

  const recoveryCodes = await regenerateRecoveryCodes(user.id);
  return { recoveryCodes };
}

/**
 * Verifies a TOTP challenge during login. Bumps session AAL to aal2 on success.
 */
export async function verifyMfaChallengeAction(code: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const cleanCode = code.replace(/\D/g, "");
  if (cleanCode.length !== 6) return { error: "Ingresá los 6 dígitos" };

  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const factor = factorsList?.totp?.find((f) => f.status === "verified");
  if (!factor) return { error: "No hay factor TOTP activo. Configurá 2FA de nuevo." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) return { error: "No se pudo generar el desafío. Volvé a intentar." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: cleanCode,
  });
  if (verifyError) return { error: "Código incorrecto. Probá con el más reciente de tu app." };

  redirect("/dashboard");
}

/**
 * Uses a recovery code to bypass TOTP. Removes the existing factor and forces
 * re-enrollment on the next page (which will then bump the session to aal2).
 * Requires service role to delete the factor while session is still aal1.
 */
export async function redeemRecoveryCodeAction(code: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const consumed = await consumeRecoveryCode(user.id, code);
  if (!consumed) return { error: "Código de recuperación inválido o ya usado" };

  const admin = createAdminClient();
  const { data: factorsList } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  const factors = factorsList?.factors ?? [];
  for (const f of factors) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
  }

  // deleteFactor logs the user out of all sessions. Send them to /login —
  // when they sign in again, the dashboard guard will force /setup-2fa.
  redirect("/login?recovered=1");
}

/**
 * Returns the number of unused recovery codes for the current user.
 */
export async function getRecoveryCodeStatusAction(): Promise<{ remaining: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { remaining: 0, error: "No autorizado" };
  const remaining = await countUnusedRecoveryCodes(user.id);
  return { remaining };
}

/**
 * Disables 2FA for the current user: unenrolls all TOTP factors and deletes
 * recovery codes. Requires aal2 (so an attacker with stolen password can't disable it).
 */
export async function disableMfaAction(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return { error: "Necesitás verificar tu 2FA antes de desactivarla" };
  }

  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const factors = factorsList?.all ?? [];
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: `No se pudo desactivar: ${error.message}` };
  }

  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });

  return { success: true };
}

/**
 * Regenerates the set of recovery codes (invalidates old ones).
 * Requires aal2 — if the session is at aal1, Supabase will reject downstream calls.
 */
export async function regenerateRecoveryCodesAction(): Promise<{
  error?: string;
  recoveryCodes?: string[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    return { error: "Necesitás verificar tu 2FA antes de regenerar los códigos" };
  }

  const recoveryCodes = await regenerateRecoveryCodes(user.id);
  return { recoveryCodes };
}
