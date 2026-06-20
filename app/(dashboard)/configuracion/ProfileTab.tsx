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
import { ReporteSemanalCard } from "./ReporteSemanalCard";
import { TwoFactorCard } from "./TwoFactorCard";
import { WhatsappCard } from "./WhatsappCard";
import { RecordatorioWhatsappCard } from "./RecordatorioWhatsappCard";
import { VencimientosCard } from "./VencimientosCard";
import { GoogleCalendarCard } from "./GoogleCalendarCard";
import { AppearanceCard } from "./AppearanceCard";

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(DIACRITICS, "");

// Orden de las categorías de configuración.
const CATEGORY_ORDER = ["Apariencia", "Cuenta", "Asistente de WhatsApp", "Seguridad", "Notificaciones", "Datos"];

export function ProfileTab({
  profileName,
  profileEmail,
  mfaEnabled,
  recoveryCodesRemaining,
  whatsappNumber,
  query = "",
}: {
  profileName: string | null;
  profileEmail: string;
  mfaEnabled: boolean;
  recoveryCodesRemaining: number;
  whatsappNumber: string | null;
  query?: string;
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

  const infoCard = (
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
  );

  const passwordCard = (
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
              <Input id="currentPassword" name="currentPassword" type={showCurrent ? "text" : "password"} placeholder="••••••••" className="pr-10" required />
              <button type="button" aria-label="Mostrar contraseña" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-3 text-muted hover:text-foreground">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Input id="password" name="password" type={showNew ? "text" : "password"} placeholder="Mínimo 8 caracteres" className="pr-10" required />
              <button type="button" aria-label="Mostrar contraseña" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-3 text-muted hover:text-foreground">
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
  );

  const dangerCard = (
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
            <p className="text-xs font-semibold text-danger text-center">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium text-muted hover:bg-surface-2 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDeleteAll} disabled={deleting} className="flex-1 py-2 px-4 rounded-lg bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {deleting ? "Eliminando..." : "Sí, eliminar todo"}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const sections = [
    { cat: "Apariencia", title: "Tema claro u oscuro", kw: "tema color apariencia modo dark light visual", node: <AppearanceCard /> },
    { cat: "Cuenta", title: "Perfil y sesión", kw: "perfil cuenta sesion cerrar salir logout email nombre", node: infoCard },
    { cat: "Cuenta", title: "Cambiar contraseña", kw: "contrasena password clave acceso", node: passwordCard },
    { cat: "Asistente de WhatsApp", title: "Asistente de WhatsApp", kw: "whatsapp bot asistente numero mensajes audios chat", node: <WhatsappCard initialNumber={whatsappNumber} /> },
    { cat: "Asistente de WhatsApp", title: "Recordatorio diario", kw: "recordatorio diario aviso whatsapp gastos noche registrar 20 ocho", node: <RecordatorioWhatsappCard hasWhatsapp={!!whatsappNumber} /> },
    { cat: "Asistente de WhatsApp", title: "Google Calendar y Tareas", kw: "google calendar tareas agenda eventos sincronizar integracion", node: <GoogleCalendarCard /> },
    { cat: "Seguridad", title: "Verificación en dos pasos", kw: "seguridad 2fa dos factores autenticacion codigos mfa autenticador", node: <TwoFactorCard mfaEnabled={mfaEnabled} recoveryCodesRemaining={recoveryCodesRemaining} /> },
    { cat: "Notificaciones", title: "Notificaciones", kw: "notificaciones push alertas avisos recordatorios", node: <NotificacionesCard /> },
    { cat: "Notificaciones", title: "Recordatorio de vencimientos", kw: "vencimientos cuotas tarjeta deudas pagar fecha agenda recordatorio vence", node: <VencimientosCard /> },
    { cat: "Notificaciones", title: "Reporte semanal por email", kw: "reporte semanal email correo resumen dia horario semana", node: <ReporteSemanalCard /> },
    { cat: "Datos", title: "Zona de peligro", kw: "eliminar borrar datos peligro reset limpiar", node: dangerCard },
  ];

  const q = norm(query.trim());
  const visible = q ? sections.filter((s) => norm(`${s.title} ${s.kw} ${s.cat}`).includes(q)) : sections;

  if (visible.length === 0) {
    return <p className="text-sm text-muted text-center py-10 max-w-sm">No encontré ninguna configuración para “{query}”.</p>;
  }

  return (
    <div className="columns-1 lg:columns-2 gap-4">
      {CATEGORY_ORDER.map((cat) => {
        const items = visible.filter((s) => s.cat === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="break-inside-avoid mb-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-1">{cat}</h3>
            {items.map((s) => (
              <div key={s.title}>{s.node}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
