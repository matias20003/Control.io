"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { crearGrupoAction } from "@/app/actions/grupos";

export function NuevoGrupoClient() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await crearGrupoAction(formData);
      if (result?.error) toast.error(result.error);
    });
  };

  return (
    <div className="max-w-md space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/grupos">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nuevo grupo</h1>
          <p className="text-sm text-muted">Creá el grupo y después invitá a los demás</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre del grupo *</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ej: Viaje a Bariloche, Casa compartida..."
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Input
                id="descripcion"
                name="descripcion"
                placeholder="Una descripción breve del grupo"
              />
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-2.5 text-sm text-muted">
              <Users size={15} className="text-primary mt-0.5 shrink-0" />
              <span>
                Vas a ser el primer miembro del grupo. Después de crearlo podrás invitar a otros por email o agregar personas manualmente.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creando..." : "Crear grupo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
