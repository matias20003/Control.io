import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getInvitacionByToken } from "@/lib/db/grupos";
import { aceptarInvitacionAction } from "@/app/actions/grupos";
import { LogoFull } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function UnirseGrupoPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const invitacion = await getInvitacionByToken(token);

  // Token no existe
  if (!invitacion) {
    return <PaginaError mensaje="Esta invitación no existe o ya fue usada." />;
  }

  // Invitación expirada o usada
  if (invitacion.estado !== "pendiente" || invitacion.expiraEn < new Date()) {
    return <PaginaError mensaje="Esta invitación ya expiró o fue usada." />;
  }

  const grupo = invitacion.grupo;

  // Si no está logueado → redirigir a login con redirect param
  if (!user) {
    redirect(`/login?redirect=/grupos/unirse/${token}`);
  }

  // Ya es miembro → ir directo al grupo
  const yaEsMiembro = grupo.miembros.some((m) => m.userId === user.id);
  if (yaEsMiembro) {
    redirect(`/grupos/${grupo.id}`);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <LogoFull className="justify-center" />
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-center">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users size={26} className="text-primary" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">Te invitaron a un grupo</h1>
            <p className="text-sm text-muted">
              Fuiste invitado a unirte al grupo
            </p>
            <p className="text-base font-semibold text-foreground mt-1">
              "{grupo.nombre}"
            </p>
            {grupo.descripcion && (
              <p className="text-sm text-muted">{grupo.descripcion}</p>
            )}
          </div>

          <div className="bg-surface-2 rounded-lg p-3 text-sm text-muted text-center">
            {grupo.miembros.length} {grupo.miembros.length === 1 ? "miembro" : "miembros"} ya en el grupo
          </div>

          {/* Acción: aceptar */}
          <form
            action={async () => {
              "use server";
              await aceptarInvitacionAction(token);
            }}
          >
            <Button type="submit" className="w-full">
              Unirme al grupo
            </Button>
          </form>

          <p className="text-xs text-muted text-center">
            Al unirte podrás ver y agregar gastos del grupo.
          </p>
        </div>
      </div>
    </div>
  );
}

function PaginaError({ mensaje }: { mensaje: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <LogoFull className="justify-center" />
        <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
          <p className="text-4xl">🔗</p>
          <h1 className="text-lg font-semibold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted">{mensaje}</p>
          <a href="/grupos" className="block mt-3">
            <Button variant="outline" className="w-full">Ir a mis grupos</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
