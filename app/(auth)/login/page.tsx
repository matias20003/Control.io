"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("email", data.email);
      fd.append("password", data.password);
      const result = await loginAction(fd);
      if (result?.error) toast.error(result.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Bienvenido de nuevo
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Ingresá a tu cuenta para continuar
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="vos@ejemplo.com"
            autoComplete="email"
            autoFocus
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-danger mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted hover:text-primary transition-colors"
            >
              Olvidé mi contraseña
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger mt-1">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted">
        ¿No tenés cuenta?{" "}
        <Link
          href="/register"
          className="text-primary hover:text-primary-dark font-medium transition-colors"
        >
          Registrate gratis
        </Link>
      </p>
    </div>
  );
}
