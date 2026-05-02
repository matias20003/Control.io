"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Equal, Sliders } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { agregarGastoAction } from "@/app/actions/grupos";
import type { SerializedGrupoDetalle } from "@/lib/db/grupos-utils";

interface Props {
  grupo: SerializedGrupoDetalle;
  currentUserId: string;
}

export function NuevoGastoClient({ grupo, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<"igual" | "custom">("igual");
  const [monto, setMonto] = useState("");
  const [montosPorMiembro, setMontosPorMiembro] = useState<Record<string, string>>(
    Object.fromEntries(grupo.miembros.map((m) => [m.id, ""]))
  );

  const totalCustom = Object.values(montosPorMiembro)
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const montoNum = parseFloat(monto) || 0;
  const diferencia = Math.abs(totalCustom - montoNum);

  // Pre-seleccionar al miembro que es el usuario actual
  const miMiembro = grupo.miembros.find((m) => m.userId === currentUserId);

  const handleSubmit = (formData: FormData) => {
    formData.set("tipo", tipo);
    if (tipo === "custom") {
      for (const [miembroId, val] of Object.entries(montosPorMiembro)) {
        formData.set(`montos_${miembroId}`, val);
      }
    }

    startTransition(async () => {
      const result = await agregarGastoAction(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Gasto agregado");
        router.push(`/grupos/${grupo.id}`);
      }
    });
  };

  // Distribuir igual automáticamente
  const distribuirIgual = () => {
    if (!montoNum) return;
    const porMiembro = (montoNum / grupo.miembros.length).toFixed(2);
    setMontosPorMiembro(
      Object.fromEntries(grupo.miembros.map((m) => [m.id, porMiembro]))
    );
  };

  return (
    <div className="max-w-md space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/grupos/${grupo.id}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Agregar gasto</h1>
          <p className="text-sm text-muted">{grupo.nombre}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="grupoId" value={grupo.id} />

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">¿En qué se gastó? *</Label>
              <Input
                id="descripcion"
                name="descripcion"
                placeholder="Ej: Pizza, supermercado, combustible..."
                required
                autoFocus
              />
            </div>

            {/* Monto */}
            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto total *</Label>
              <Input
                id="monto"
                name="monto"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>

            {/* Quién pagó */}
            <div className="space-y-1.5">
              <Label htmlFor="pagadoPorId">¿Quién pagó? *</Label>
              <select
                id="pagadoPorId"
                name="pagadoPorId"
                required
                defaultValue={miMiembro?.id ?? ""}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>Seleccioná quién pagó</option>
                {grupo.miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}{m.userId === currentUserId ? " (vos)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de división */}
            <div className="space-y-2">
              <Label>¿Cómo dividir?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipo("igual")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all",
                    tipo === "igual"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  )}
                >
                  <Equal size={14} />
                  Partes iguales
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("custom")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all",
                    tipo === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  )}
                >
                  <Sliders size={14} />
                  Personalizado
                </button>
              </div>
            </div>

            {/* División por persona (solo custom) */}
            {tipo === "custom" && (
              <div className="space-y-2 bg-surface-2 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">Monto por persona</p>
                  <button
                    type="button"
                    onClick={distribuirIgual}
                    className="text-xs text-primary hover:underline"
                  >
                    Distribuir igual
                  </button>
                </div>
                {grupo.miembros.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="text-sm text-foreground flex-1 truncate">
                      {m.nombre}{m.userId === currentUserId ? " (vos)" : ""}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className="w-28 text-right"
                      value={montosPorMiembro[m.id] ?? ""}
                      onChange={(e) =>
                        setMontosPorMiembro((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className={cn(
                  "flex justify-between text-xs pt-1 border-t border-border mt-2",
                  diferencia > 0.01 ? "text-danger" : "text-success"
                )}>
                  <span>Total asignado</span>
                  <span className="font-semibold">
                    {formatCurrency(totalCustom)}
                    {diferencia > 0.01 && ` (faltan ${formatCurrency(montoNum - totalCustom)})`}
                  </span>
                </div>
              </div>
            )}

            {/* Preview partes iguales */}
            {tipo === "igual" && montoNum > 0 && (
              <div className="text-xs text-muted bg-surface-2 rounded-lg p-3">
                {formatCurrency(montoNum)} ÷ {grupo.miembros.length} miembros ={" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(montoNum / grupo.miembros.length)} por persona
                </span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || (tipo === "custom" && diferencia > 0.01)}
            >
              {isPending ? "Guardando..." : "Agregar gasto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
