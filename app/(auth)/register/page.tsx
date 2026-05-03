"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, verifyOtpAction } from "@/app/actions/auth";

const schema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir una mayúscula")
      .regex(/[0-9]/, "Debe incluir un número"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("email", data.email);
      fd.append("password", data.password);
      const result = await registerAction(fd);
      if (result?.error) toast.error(result.error);
      else if (result?.needsOtp) setPendingEmail(result.email);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = otp.join("");
    if (token.length !== 6) {
      toast.error("Ingresá los 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyOtpAction(pendingEmail!, token);
      if (result?.error) toast.error(result.error);
    } finally {
      setVerifying(false);
    }
  };

  // ── Paso 2: ingresar código OTP ──
  if (pendingEmail) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail size={22} className="text-primary" strokeWidth={1.7} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Revisá tu email</h2>
            <p className="mt-1.5 text-sm text-muted">
              Enviamos un código de 6 dígitos a{" "}
              <span className="font-medium text-foreground">{pendingEmail}</span>
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Inputs OTP */}
          <div className="flex justify-center gap-2.5">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-11 h-14 text-center text-xl font-bold rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono caret-primary"
              />
            ))}
          </div>

          <Button onClick={handleVerify} className="w-full h-11" disabled={verifying}>
            {verifying && <Loader2 size={15} className="animate-spin" />}
            {verifying ? "Verificando..." : "Confirmar código"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted">
          ¿No llegó?{" "}
          <button
            className="text-primary hover:text-primary-dark font-medium transition-colors"
            onClick={() => { setPendingEmail(null); setOtp(["","","","","",""]); }}
          >
            Volver a intentarlo
          </button>
        </p>
      </div>
    );
  }

  // ── Paso 1: formulario de registro ──
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Crear cuenta</h1>
        <p className="mt-1.5 text-sm text-muted">Empezá a controlar tus finanzas hoy</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre completo</Label>
          <Input id="name" type="text" placeholder="Tu nombre" autoComplete="name" autoFocus {...register("name")} />
          {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="vos@ejemplo.com" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-xs text-danger mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-primary hover:text-primary-dark font-medium transition-colors">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
