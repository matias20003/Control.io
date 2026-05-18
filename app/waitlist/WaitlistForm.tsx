"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { subscribeToWaitlistAction } from "@/app/actions/waitlist";

const PROFILE_OPTIONS = [
  { value: "organize", label: "Organizar mis gastos del día a día" },
  { value: "save_goals", label: "Ahorrar para metas concretas" },
  { value: "invest", label: "Tener mis inversiones en un solo lugar" },
  { value: "other", label: "Otra cosa / Curiosidad" },
];

type Success = { already: boolean; position: number; message: string };

export function WaitlistForm() {
  const [profile, setProfile] = useState("organize");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Success | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    formData.set("profile", profile);
    // Source tracker simple: vemos qué ?ref= trajo a la persona.
    const ref = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref")
      : null;
    if (ref) formData.set("source", ref);

    startTransition(async () => {
      const res = await subscribeToWaitlistAction(formData);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (res.success) {
        setResult({
          already: res.already,
          position: res.position,
          message: res.message,
        });
      }
    });
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/15 ring-1 ring-success/40">
          <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={2.2} />
        </div>
        <p className="mt-5 text-xl font-semibold text-foreground">
          {result.message}
        </p>
        <p className="mt-2 text-sm text-muted">
          {result.already
            ? "Te tenemos guardado. Vas a recibir el acceso cuando abramos."
            : "Te avisamos por mail apenas tu lugar esté listo."}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted">
          <span>Sos el</span>
          <span className="font-mono text-base text-primary">
            #{result.position.toLocaleString("es-AR")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 text-left"
      noValidate
    >
      <div className="space-y-2">
        <input
          type="text"
          name="name"
          placeholder="Tu nombre"
          required
          autoComplete="given-name"
          maxLength={60}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-foreground placeholder-muted backdrop-blur-xl outline-none transition-all duration-200 focus:border-primary/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-primary/25"
        />
        <input
          type="email"
          name="email"
          inputMode="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
          maxLength={120}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-foreground placeholder-muted backdrop-blur-xl outline-none transition-all duration-200 focus:border-primary/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-primary/25"
        />
      </div>

      <fieldset className="space-y-1.5 pt-2">
        <legend className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
          ¿Para qué te interesa?
        </legend>
        <div className="grid grid-cols-1 gap-1.5">
          {PROFILE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-150 backdrop-blur-xl ${
                profile === opt.value
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="profile-radio"
                value={opt.value}
                checked={profile === opt.value}
                onChange={() => setProfile(opt.value)}
                className="sr-only"
              />
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  profile === opt.value
                    ? "border-primary bg-primary"
                    : "border-muted-2 group-hover:border-muted"
                }`}
              >
                {profile === opt.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-background" />
                )}
              </span>
              <span className="leading-snug">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary via-[oklch(0.65_0.21_280)] to-[oklch(0.62_0.18_240)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_32px_oklch(0.67_0.19_258/40%)] transition-all duration-200 hover:shadow-[0_12px_40px_oklch(0.67_0.19_258/55%)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative">
          {pending ? "Guardando..." : "Quiero acceso anticipado"}
        </span>
        {!pending && (
          <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </button>

      <p className="pt-2 text-center text-[11px] text-muted">
        Cero spam. Te escribimos solo cuando esté listo tu acceso.
      </p>
    </form>
  );
}
