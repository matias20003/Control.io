"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enrollTotpAction, verifyEnrollmentAction } from "@/app/actions/mfa";

type Phase = "intro" | "qr" | "codes";

export function Setup2FAClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const result = await enrollTotpAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setFactorId(result.factorId);
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setPhase("qr");
    } finally {
      setEnrolling(false);
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
    if (!factorId) return;
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Ingresá los 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyEnrollmentAction(factorId, code);
      if (result.error) {
        toast.error(result.error);
        setOtp(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
        return;
      }
      if (result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
        setPhase("codes");
      }
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success("Secret copiado");
  };

  const copyAllCodes = async () => {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success("Códigos copiados");
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const content = [
      "control.io · códigos de recuperación 2FA",
      "Guardá este archivo en un lugar seguro. Cada código se usa una sola vez.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "control-io-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const goBackToSettings = () => {
    router.push("/configuracion");
  };

  // Auto-focus first OTP input when QR phase shows
  useEffect(() => {
    if (phase === "qr") {
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    }
  }, [phase]);

  if (phase === "intro") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck size={26} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Configurá tu 2FA</h1>
          <p className="text-sm text-muted">
            Sumá una capa extra de seguridad. Aún si alguien obtiene tu contraseña,
            no va a poder entrar sin el código que genera tu app.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Smartphone size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Necesitás una app de autenticación</p>
              <p className="text-xs text-muted mt-0.5">
                Google Authenticator, Authy, 1Password, Microsoft Authenticator, o cualquier app TOTP.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={startEnrollment} className="w-full" disabled={enrolling}>
          {enrolling && <Loader2 size={16} className="animate-spin mr-1" />}
          {enrolling ? "Iniciando..." : "Empezar configuración"}
        </Button>
      </div>
    );
  }

  if (phase === "qr" && qrCode && secret) {
    const qrSrc = qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
    return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Escaneá el código QR</h1>
          <p className="text-sm text-muted">Abrí tu app de autenticación y escaneá el QR.</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-white rounded-xl p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, next/image no aplica */}
            <img src={qrSrc} alt="QR code 2FA" className="w-48 h-48" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-2">
          <p className="text-xs text-muted">
            ¿No podés escanear? Ingresá esta clave manualmente:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-background rounded px-2 py-1.5 text-foreground break-all">
              {secret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Copiar secret"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted text-center">
            Ingresá el código de 6 dígitos que muestra la app:
          </p>
          <div className="flex justify-center gap-2">
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
                className="w-11 h-14 text-center text-xl font-bold rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            ))}
          </div>
        </div>

        <Button onClick={handleVerify} className="w-full" disabled={verifying}>
          {verifying && <Loader2 size={16} className="animate-spin mr-1" />}
          {verifying ? "Verificando..." : "Verificar y activar"}
        </Button>
      </div>
    );
  }

  if (phase === "codes" && recoveryCodes) {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <ShieldCheck size={26} className="text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">2FA activada</h1>
          <p className="text-sm text-muted">
            Guardá estos <strong className="text-foreground">códigos de recuperación</strong> en un lugar seguro.
            Te van a permitir entrar si perdés tu dispositivo.
          </p>
        </div>

        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
          <p className="text-xs text-warning font-medium">
            ⚠️ Esta es la única vez que vas a ver estos códigos. Cada uno se usa una sola vez.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <code
                key={code}
                className="font-mono text-sm bg-background rounded px-2 py-1.5 text-foreground text-center"
              >
                {code}
              </code>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={copyAllCodes} className="w-full">
            <Copy size={14} className="mr-1.5" />
            Copiar
          </Button>
          <Button variant="ghost" onClick={downloadCodes} className="w-full">
            <Download size={14} className="mr-1.5" />
            Descargar
          </Button>
        </div>

        <label className="flex items-start gap-2 cursor-pointer text-sm text-muted">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 cursor-pointer accent-primary"
          />
          <span>Guardé mis códigos de recuperación en un lugar seguro.</span>
        </label>

        <Button onClick={goBackToSettings} className="w-full" disabled={!acknowledged}>
          Volver a configuración
        </Button>
      </div>
    );
  }

  return null;
}
