"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemRecoveryCodeAction, verifyMfaChallengeAction } from "@/app/actions/mfa";

type Mode = "totp" | "recovery";

export function LoginVerifyClient() {
  const [mode, setMode] = useState<Mode>("totp");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (mode === "totp") {
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    }
  }, [mode]);

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

  const handleVerifyTotp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Ingresá los 6 dígitos");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyMfaChallengeAction(code);
      if (result?.error) {
        toast.error(result.error);
        setOtp(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleUseRecovery = async () => {
    const trimmed = recoveryCode.trim();
    if (trimmed.length < 8) {
      toast.error("Ingresá un código de recuperación válido");
      return;
    }
    setVerifying(true);
    try {
      const result = await redeemRecoveryCodeAction(trimmed);
      if (result?.error) toast.error(result.error);
    } finally {
      setVerifying(false);
    }
  };

  if (mode === "recovery") {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <KeyRound size={26} className="text-warning" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Código de recuperación</h1>
          <p className="text-sm text-muted">
            Ingresá uno de los códigos que guardaste al activar 2FA.
            Se va a usar una sola vez y vas a tener que reconfigurar 2FA después.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recovery">Código</Label>
          <Input
            id="recovery"
            type="text"
            placeholder="XXXXX-XXXXX"
            autoComplete="off"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleUseRecovery(); }}
            className="font-mono uppercase tracking-wider"
          />
        </div>

        <Button onClick={handleUseRecovery} className="w-full" disabled={verifying}>
          {verifying && <Loader2 size={16} className="animate-spin mr-1" />}
          {verifying ? "Verificando..." : "Usar código"}
        </Button>

        <button
          type="button"
          onClick={() => setMode("totp")}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          Volver al código de la app
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <ShieldCheck size={26} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Verificación en dos pasos</h1>
        <p className="text-sm text-muted">
          Abrí tu app de autenticación y entrá el código de 6 dígitos.
        </p>
      </div>

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

      <Button onClick={handleVerifyTotp} className="w-full" disabled={verifying}>
        {verifying && <Loader2 size={16} className="animate-spin mr-1" />}
        {verifying ? "Verificando..." : "Verificar"}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setMode("recovery")}
          className="text-sm text-primary hover:underline"
        >
          Usar un código de recuperación
        </button>
      </div>
    </div>
  );
}
