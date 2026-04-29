"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function loginAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = loginSchema.safeParse(raw);

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed")) {
      return { error: "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada." };
    }
    if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("wrong password")) {
      return { error: "Email o contraseña incorrectos" };
    }
    return { error: `Error al ingresar: ${error.message}` };
  }

  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const result = registerSchema.safeParse(raw);

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: { name: result.data.name },
      // Sin emailRedirectTo → Supabase envía código OTP de 6 dígitos en vez de link
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("user already registered")) {
      return { error: "Este email ya está registrado" };
    }
    return { error: `Error al registrar: ${error.message}` };
  }

  return { needsOtp: true, email: result.data.email };
}

export async function verifyOtpAction(email: string, token: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return { error: "Código incorrecto o expirado. Revisá tu email." };
  }

  redirect("/dashboard");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email?.includes("@")) return { error: "Email inválido" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  if (error) return { error: "Error al enviar el email" };

  return { success: "Si el email existe, vas a recibir el link en breve" };
}

export async function resetPasswordAction(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: "Error al actualizar la contraseña. El link puede haber expirado." };

  redirect("/login");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
