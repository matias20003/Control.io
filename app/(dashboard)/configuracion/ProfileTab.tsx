"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LogOut, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { signOutAction, updatePasswordAction } from "@/app/actions/auth";
import { deleteAllDataAction } from "@/app/actions/data";
import { NotificacionesCard } from "./NotificacionesCard";
import { TwoFactorCard } from "./TwoFactorCard";
import { WhatsappCard } from "./WhatsappCard";

export function ProfileTab({
  profileName,
  profileEmail,
  mfaEnabled,
  recoveryCodesRemaining,
  whatsappNumber,
}: {
  profileName: string | null;
  profileEmail: string;
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
  whatsappNumber: string | null;
}) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const result = await deleteAllDataAction();
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Todos los datos fueron eliminados");
        setShowDeleteConfirm(false);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handlePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updatePasswordAction(new FormData(e.currentTarget));
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result.success!);
        (e.target as HTMLFormElement).reset();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-sm">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
              {(profileName || profileEmail)[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{profileName || "Sin nombre"}</p>
              <p className="text-sm text-muted">{profileEmail}</p>
            </div>
          </div>
          <div className="pt-1 border-t border-border">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-all w-full border border-danger/30"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </form>
          </div>
        </CardContent>
      </Card>

      <NotificacionesCard />

      <WhatsappCard initialNumber={whatsappNumber} />

      <TwoFactorCard mfaEnabled={mfaEnabled} recoveryCodesRemaining={recoveryCodesRemaining} />

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Cambiar contraseña</p>
          </div>

          <form onSubmit={handlePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="••••••••"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-3 text-muted hover:text-foreground"
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showNew ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-muted hover:text-foreground"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 size={15} className="animate-spin mr-1" />}
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-semibold text-danger">Zona de peligro</p>
          <p className="text-xs text-muted">
            Esto elimina permanentemente todos tus movimientos, cuentas, categorías, inversiones, deudas, metas y presupuestos. No se puede deshacer.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 px-4 rounded-lg border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
            >
              Eliminar todos mis datos
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-danger text-center">
                ¿Estás seguro? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium text-muted hover:bg-surface-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  className="flex-1 py-2 px-4 rounded-lg bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar todo"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
