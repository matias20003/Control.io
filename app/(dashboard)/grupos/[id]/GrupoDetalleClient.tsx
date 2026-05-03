"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Users, Trash2, Mail, UserPlus,
  TrendingUp, TrendingDown, Minus, ArrowRight, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  invitarMiembroAction,
  agregarMiembroAction,
  eliminarGastoAction,
  eliminarGrupoAction,
} from "@/app/actions/grupos";
import type {
  SerializedGrupoDetalle,
  SerializedGasto,
  Balance,
  Pago,
} from "@/lib/db/grupos-utils";
import { calcularBalances, calcularLiquidacion } from "@/lib/db/grupos-utils";

interface Props {
  grupo: SerializedGrupoDetalle;
  currentUserId: string;
}

export function GrupoDetalleClient({ grupo: initialGrupo, currentUserId }: Props) {
  const [grupo, setGrupo] = useState(initialGrupo);
  const [tab, setTab] = useState<"gastos" | "balances" | "miembros">("gastos");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isDeleteGrupoOpen, setIsDeleteGrupoOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const esCreador = grupo.userId === currentUserId;

  const balances = calcularBalances(grupo.miembros, grupo.gastos);
  const liquidacion = calcularLiquidacion(balances);

  // Mi balance (el miembro con userId === currentUserId)
  const miMiembro = grupo.miembros.find((m) => m.userId === currentUserId);
  const miBalance = balances.find((b) => b.miembroId === miMiembro?.id);

  const handleInvitar = (formData: FormData) => {
    startTransition(async () => {
      const result = await invitarMiembroAction(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.warning ?? "Invitación enviada");
        setIsInviteOpen(false);
      }
    });
  };

  const handleAgregarMiembro = (formData: FormData) => {
    startTransition(async () => {
      const result = await agregarMiembroAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.miembro) {
        setGrupo((prev) => ({ ...prev, miembros: [...prev.miembros, result.miembro!] }));
        setIsAddMemberOpen(false);
        toast.success("Miembro agregado");
      }
    });
  };

  const handleEliminarGasto = (gastoId: string) => {
    startTransition(async () => {
      const result = await eliminarGastoAction(gastoId, grupo.id);
      if (result.error) toast.error(result.error);
      else {
        setGrupo((prev) => ({ ...prev, gastos: prev.gastos.filter((g) => g.id !== gastoId) }));
        toast.success("Gasto eliminado");
      }
    });
  };

  const handleEliminarGrupo = () => {
    startTransition(async () => {
      await eliminarGrupoAction(grupo.id);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/grupos">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{grupo.nombre}</h1>
            {grupo.descripcion && (
              <p className="text-sm text-muted">{grupo.descripcion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setIsAddMemberOpen(true)}
          >
            <UserPlus size={13} />
            Agregar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setIsInviteOpen(true)}
          >
            <Mail size={13} />
            Invitar
          </Button>
          <Link href={`/grupos/${grupo.id}/gasto/nuevo`}>
            <Button size="sm" className="gap-1.5">
              <Plus size={13} />
              Gasto
            </Button>
          </Link>
        </div>
      </div>

      {/* Resumen */}
      {miBalance && (
        <div className={cn(
          "rounded-xl border p-4 flex items-center justify-between",
          miBalance.balance > 0.01 && "bg-success/5 border-success/30",
          miBalance.balance < -0.01 && "bg-danger/5 border-danger/30",
          Math.abs(miBalance.balance) <= 0.01 && "bg-surface-2 border-border",
        )}>
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wide">Tu balance en el grupo</p>
            <p className={cn(
              "text-2xl font-bold mt-0.5",
              miBalance.balance > 0.01 && "text-success",
              miBalance.balance < -0.01 && "text-danger",
              Math.abs(miBalance.balance) <= 0.01 && "text-foreground",
            )}>
              {miBalance.balance > 0.01 ? "+" : ""}{formatCurrency(miBalance.balance)}
            </p>
          </div>
          {miBalance.balance > 0.01 && <TrendingUp size={28} className="text-success opacity-50" />}
          {miBalance.balance < -0.01 && <TrendingDown size={28} className="text-danger opacity-50" />}
          {Math.abs(miBalance.balance) <= 0.01 && <Minus size={28} className="text-muted opacity-50" />}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        {(["gastos", "balances", "miembros"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            {t === "gastos" ? `Gastos (${grupo.gastos.length})` :
             t === "balances" ? "Liquidación" :
             `Miembros (${grupo.miembros.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Gastos */}
      {tab === "gastos" && (
        <div className="space-y-3">
          {grupo.gastos.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin gastos todavía"
              description="Agregá el primer gasto del grupo."
              action={
                <Link href={`/grupos/${grupo.id}/gasto/nuevo`}>
                  <Button size="sm" className="gap-2"><Plus size={14} />Agregar gasto</Button>
                </Link>
              }
            />
          ) : (
            grupo.gastos.map((gasto) => (
              <GastoRow
                key={gasto.id}
                gasto={gasto}
                miembros={grupo.miembros.reduce((acc, m) => ({ ...acc, [m.id]: m.nombre }), {} as Record<string, string>)}
                miMiembroId={miMiembro?.id}
                onEliminar={() => handleEliminarGasto(gasto.id)}
                isPending={isPending}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Liquidación */}
      {tab === "balances" && (
        <div className="space-y-4">
          {/* Balances individuales */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Balance por persona</h3>
            {balances.map((b) => (
              <div key={b.miembroId} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface-2">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {b.nombre[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground">{b.nombre}</span>
                  {b.miembroId === miMiembro?.id && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Vos</span>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  b.balance > 0.01 && "text-success",
                  b.balance < -0.01 && "text-danger",
                  Math.abs(b.balance) <= 0.01 && "text-muted",
                )}>
                  {b.balance > 0.01 ? "+" : ""}{formatCurrency(b.balance)}
                </span>
              </div>
            ))}
          </div>

          {/* Pagos sugeridos */}
          {liquidacion.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Para liquidar</h3>
              <p className="text-xs text-muted">Mínima cantidad de transferencias para saldar todo:</p>
              {liquidacion.map((pago, i) => (
                <div key={i} className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-border bg-background">
                  <span className={cn("text-sm font-medium", pago.deudorId === miMiembro?.id ? "text-danger" : "text-foreground")}>
                    {pago.deudorNombre}
                  </span>
                  <ArrowRight size={14} className="text-muted shrink-0" />
                  <span className={cn("text-sm font-medium", pago.acreedorId === miMiembro?.id ? "text-success" : "text-foreground")}>
                    {pago.acreedorNombre}
                  </span>
                  <span className="ml-auto text-sm font-bold text-foreground">{formatCurrency(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}

          {liquidacion.length === 0 && (
            <div className="text-center py-8 text-sm text-muted">
              ✅ Todos los balances están en cero — nadie se debe nada.
            </div>
          )}
        </div>
      )}

      {/* Tab: Miembros */}
      {tab === "miembros" && (
        <div className="space-y-2">
          {grupo.miembros.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-surface-2">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {m.nombre[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.nombre}</p>
                {m.email && <p className="text-xs text-muted truncate">{m.email}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                {m.esCreador && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Creador</span>
                )}
                {m.userId === currentUserId && !m.esCreador && (
                  <span className="text-[10px] bg-surface border border-border text-muted px-1.5 py-0.5 rounded font-medium">Vos</span>
                )}
              </div>
            </div>
          ))}

          {esCreador && (
            <div className="pt-4 border-t border-border mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger hover:bg-danger/10 gap-1.5"
                onClick={() => setIsDeleteGrupoOpen(true)}
              >
                <Trash2 size={13} />
                Eliminar grupo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Invitar por email */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent title="Invitar por email">
          <h2 className="text-lg font-semibold mb-4">Invitar por email</h2>
          <form action={handleInvitar} className="space-y-3">
            <input type="hidden" name="grupoId" value={grupo.id} />
            <div className="space-y-1.5">
              <Label htmlFor="inv-nombre">Nombre (opcional)</Label>
              <Input id="inv-nombre" name="nombre" placeholder="Juan García" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email *</Label>
              <Input id="inv-email" name="email" type="email" placeholder="juan@email.com" required />
            </div>
            <p className="text-xs text-muted">
              Les llegará un email con un link para unirse al grupo. El link expira en 7 días.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar miembro manualmente */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent title="Agregar miembro">
          <h2 className="text-lg font-semibold mb-4">Agregar miembro</h2>
          <form action={handleAgregarMiembro} className="space-y-3">
            <input type="hidden" name="grupoId" value={grupo.id} />
            <div className="space-y-1.5">
              <Label htmlFor="add-nombre">Nombre *</Label>
              <Input id="add-nombre" name="nombre" placeholder="Juan García" required autoFocus />
            </div>
            <p className="text-xs text-muted">
              Este miembro no tendrá cuenta en control.io. Solo podés cargar gastos en su nombre.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddMemberOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar grupo */}
      <Dialog open={isDeleteGrupoOpen} onOpenChange={setIsDeleteGrupoOpen}>
        <DialogContent title="Eliminar grupo">
          <h2 className="text-lg font-semibold mb-2">Eliminar grupo</h2>
          <p className="text-sm text-muted mb-4">
            ¿Estás seguro? Se eliminarán todos los gastos y miembros del grupo. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteGrupoOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isPending}
              onClick={handleEliminarGrupo}
            >
              {isPending ? "Eliminando..." : "Eliminar grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-componente: fila de gasto ───

function GastoRow({
  gasto,
  miembros,
  miMiembroId,
  onEliminar,
  isPending,
}: {
  gasto: SerializedGasto;
  miembros: Record<string, string>;
  miMiembroId?: string;
  onEliminar: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const miDivision = gasto.divisiones.find((d) => d.miembroId === miMiembroId);
  const yoPague = gasto.pagadoPorId === miMiembroId;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full text-left px-4 py-3 flex items-center gap-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="size-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
            <Receipt size={15} className="text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{gasto.descripcion}</p>
            <p className="text-xs text-muted">
              Pagó: <span className="font-medium text-foreground">{gasto.pagadoPorNombre}</span>
              {" · "}{formatDate(gasto.fecha)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{formatCurrency(gasto.monto)}</p>
            {miDivision && (
              <p className={cn("text-xs", yoPague ? "text-success" : "text-muted")}>
                {yoPague ? `te deben ${formatCurrency(gasto.monto - miDivision.monto)}` : `tu parte: ${formatCurrency(miDivision.monto)}`}
              </p>
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">División</p>
            {gasto.divisiones.map((d) => (
              <div key={d.id} className="flex justify-between text-sm">
                <span className={cn("text-muted", d.miembroId === miMiembroId && "font-semibold text-foreground")}>
                  {miembros[d.miembroId] ?? "?"}
                  {d.miembroId === miMiembroId && " (vos)"}
                </span>
                <span className="font-medium text-foreground">{formatCurrency(d.monto)}</span>
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger hover:bg-danger/10 gap-1 text-xs"
                onClick={onEliminar}
                disabled={isPending}
              >
                <Trash2 size={11} />
                Eliminar gasto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
