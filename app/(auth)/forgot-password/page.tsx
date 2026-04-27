"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction } from "@/app/actions/auth";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("email", data.email);
      const result = await forgotPasswordAction(fd);
      if (result?.error) toast.error(result.error);
      else setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <Mail size={28} className="text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Email enviado</h2>
          <p className="text-sm text-muted mt-2">
            Si existe una cuenta con ese email, vas a recibir el link en breve.
          </p>
        </div>
        <Link href="/login" className="inline-flex items-center gap-1 text-muted hover:text-foreground text-sm transition-colors">
          <ArrowLeft size={14} /> Volver al login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted">
          Ingresá tu email y te enviamos un link para resetearla
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="vos@ejemplo.com" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Enviando..." : "Enviar link"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="inline-flex items-center gap-1 text-muted hover:text-foreground text-sm transition-colors">
          <ArrowLeft size={14} /> Volver al login
        </Link>
      </div>
    </div>
  );
}
