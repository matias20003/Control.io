"use client";

import Link from "next/link";
import { Users, Plus, ArrowRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import type { SerializedGrupo } from "@/lib/db/grupos-utils";

interface Props {
  initialGrupos: SerializedGrupo[];
}

export function GruposClient({ initialGrupos }: Props) {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grupos</h1>
          <p className="text-sm text-muted mt-0.5">Dividí gastos con amigos, familia o compañeros</p>
        </div>
        <Link href="/grupos/nuevo">
          <Button size="sm" className="gap-2">
            <Plus size={15} />
            Nuevo grupo
          </Button>
        </Link>
      </div>

      {/* Lista */}
      {initialGrupos.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin grupos todavía"
          description="Creá tu primer grupo para empezar a dividir gastos con otras personas."
          action={
            <Link href="/grupos/nuevo">
              <Button size="sm" className="gap-2">
                <Plus size={14} />
                Crear grupo
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initialGrupos.map((grupo) => (
            <Link key={grupo.id} href={`/grupos/${grupo.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users size={17} className="text-primary" />
                    </div>
                    <ArrowRight size={15} className="text-muted group-hover:text-foreground transition-colors mt-1" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-0.5 truncate">{grupo.nombre}</h3>
                  {grupo.descripcion && (
                    <p className="text-xs text-muted truncate mb-2">{grupo.descripcion}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Users size={11} />
                      {grupo.cantidadMiembros} {grupo.cantidadMiembros === 1 ? "miembro" : "miembros"}
                    </span>
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Receipt size={11} className="text-muted" />
                      {formatCurrency(grupo.totalGastos)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
