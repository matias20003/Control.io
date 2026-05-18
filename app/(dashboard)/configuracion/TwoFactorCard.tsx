"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { disableMfaAction, regenerateRecoveryCodesAction } from "@/app/actions/mfa";

export function TwoFactorCard({
  mfaEnabled,
  recoveryCodesRemaining,
}: {
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
}) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateRecoveryCodesAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.recoveryCodes) {
        setNewCodes(result.recoveryCodes);
        setConfirmRegenerate(false);
        toast.success("Códigos regenerados — guardalos");
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    try {
      const result = await disableMfaAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("2FA desactivada");
      setConfirmDisable(false);
      router.refresh();
    } finally {
      setDisabling(false);
    }
  };

  const copyAll = async () => {
    if (!newCodes) return;
    await navigator.clipboard.writeText(newCodes.join("\n"));
    toast.success("Códigos copiados");
  };

  const downloadCodes = () => {
    if (!newCodes) return;
    const content = [
      "control.io · códigos de recuperación 2FA",
      "Guardá este archivo en un lugar seguro. Cada código se usa una sola vez.",
      "",
      ...newCodes,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "control-io-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mfaEnabled) {
    return (
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-muted" />
            <p className="text-sm font-semibold text-foreground">Verificación en dos pasos</p>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted font-medium">
              No activada
            </span>
          </div>
          <p className="text-xs text-muted">
            Sumá una capa extra de seguridad. Aún si alguien obtiene tu contraseña, no va a poder entrar sin el código que genera tu app.
          </p>
          <Link
            href="/setup-2fa"
            className="block w-full text-center py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Activar 2FA
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-success" />
          <p className="text-sm font-semibold text-foreground">Verificación en dos pasos</p>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
            Activa
          </span>
        </div>

        <p className="text-xs text-muted">
          Tu cuenta está protegida con 2FA por TOTP. Te quedan{" "}
          <strong className="text-foreground">{recoveryCodesRemaining}</strong> códigos de recuperación
          {recoveryCodesRemaining <= 2 && recoveryCodesRemaining > 0 && (
            <span className="text-warning"> — te recomendamos regenerarlos.</span>
          )}
          {recoveryCodesRemaining === 0 && <span className="text-danger"> — generá códigos nuevos ya.</span>}
        </p>

        {newCodes ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs text-warning font-medium">
                ⚠️ Esta es la única vez que vas a ver estos códigos. Los anteriores ya no sirven.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                {newCodes.map((code) => (
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
              <Button variant="ghost" onClick={copyAll}>
                <Copy size={14} className="mr-1.5" />
                Copiar
              </Button>
              <Button variant="ghost" onClick={downloadCodes}>
                <Download size={14} className="mr-1.5" />
                Descargar
              </Button>
            </div>
            <Button onClick={() => setNewCodes(null)} className="w-full">
              Listo, los guardé
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {!confirmRegenerate && !confirmDisable && (
              <>
                <button
                  onClick={() => setConfirmRegenerate(true)}
                  className="w-full py-2 px-4 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Regenerar códigos de recuperación
                </button>
                <button
                  onClick={() => setConfirmDisable(true)}
                  className="w-full py-2 px-4 rounded-lg border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
                >
                  Desactivar 2FA
                </button>
              </>
            )}

            {confirmRegenerate && (
              <>
                <p className="text-xs text-muted text-center">Esto invalida los códigos anteriores. ¿Continuar?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRegenerate(false)}
                    className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium text-muted hover:bg-surface-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex-1 py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {regenerating ? "Generando..." : "Sí, regenerar"}
                  </button>
                </div>
              </>
            )}

            {confirmDisable && (
              <>
                <p className="text-xs text-danger text-center font-medium">
                  Vas a quedar sólo con email + contraseña. ¿Estás seguro?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDisable(false)}
                    className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium text-muted hover:bg-surface-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDisable}
                    disabled={disabling}
                    className="flex-1 py-2 px-4 rounded-lg bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {disabling ? "Desactivando..." : "Sí, desactivar"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
