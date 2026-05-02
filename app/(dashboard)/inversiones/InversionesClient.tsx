"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  createInvestmentAction,
  deleteInvestmentAction,
} from "@/app/actions/investments";
import type { SerializedInvestment } from "@/lib/db/investments";
import type { DolarRate } from "@/lib/services/dolar";

const TYPE_LABELS: Record<string, string> = {
  USD_OFICIAL: "Dólar Oficial",
  USD_BLUE: "Dólar Blue",
  USD_MEP: "Dólar MEP",
  USD_CCL: "Dólar CCL",
  CRYPTO: "Cripto",
  FIXED_TERM: "Plazo Fijo",
  STOCKS: "Acciones",
  BONDS: "Bonos",
  FUND: "Fondo de inversión",
  OTHER: "Otro",
};

const TYPE_ICONS: Record<string, string> = {
  USD_OFICIAL: "💵",
  USD_BLUE: "💵",
  USD_MEP: "💵",
  USD_CCL: "💵",
  CRYPTO: "₿",
  FIXED_TERM: "🏦",
  STOCKS: "📈",
  BONDS: "📄",
  FUND: "🧺",
  OTHER: "💼",
};

interface Props {
  initialInvestments: SerializedInvestment[];
  rates: DolarRate[];
}

export function InversionesClient({ initialInvestments, rates }: Props) {
  const [investments, setInvestments] =
    useState<SerializedInvestment[]>(initialInvestments);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createInvestmentAction(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.investment) {
        setInvestments((prev) => [result.investment!, ...prev]);
        setIsOpen(false);
        toast.success("Inversión registrada");
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteInvestmentAction(id);
      if (result.error) toast.error(result.error);
      else {
        setInvestments((prev) => prev.filter((i) => i.id !== id));
        toast.success("Inversión eliminada");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inversiones</h1>
          <p className="text-sm text-muted mt-0.5">
            {investments.length} posición
            {investments.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          Nueva
        </Button>
      </div>

      {/* Dolar rates */}
      {rates.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Cotizaciones hoy
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {rates.map((r) => (
              <div
                key={r.type}
                className="bg-surface border border-border rounded-xl p-3"
              >
                <p className="text-xs text-muted leading-tight mb-1">
                  {r.name}
                </p>
                <p className="text-sm font-bold font-mono text-foreground">
                  {r.sell != null ? `$${r.sell.toLocaleString("es-AR")}` : "—"}
                </p>
                {r.buy != null && (
                  <p className="text-xs text-muted font-mono">
                    Compra ${r.buy.toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investments list */}
      {investments.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin inversiones registradas"
          description="Registrá tus dólares, plazos fijos, cripto y más."
          action={
            <Button onClick={() => setIsOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nueva inversión
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted">Total invertido</span>
            <span className="text-sm font-bold font-mono text-foreground">
              {formatCurrency(totalInvested, "ARS")}
            </span>
          </div>
          {investments.map((inv) => {
            const pl =
              inv.currentValue != null
                ? inv.currentValue - inv.amount
                : null;
            const plPct =
              pl != null && inv.amount > 0
                ? ((pl / inv.amount) * 100).toFixed(1)
                : null;

            return (
              <Card key={inv.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-base flex-shrink-0">
                      {TYPE_ICONS[inv.type] || "💼"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {inv.name}
                        </p>
                        <p className="text-sm font-bold font-mono text-foreground flex-shrink-0">
                          {formatCurrency(inv.amount, inv.currency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted">
                          {TYPE_LABELS[inv.type]}
                          {inv.ticker && ` · ${inv.ticker}`}
                          {inv.units && ` · ${inv.units} u.`}
                        </p>
                        {pl != null && (
                          <p
                            className={`text-xs font-mono font-semibold ${
                              pl >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {pl >= 0 ? "+" : ""}
                            {formatCurrency(pl, inv.currency)} ({plPct}%)
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      disabled={deletingId === inv.id || isPending}
                      className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nueva inversión">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nombre *</Label>
              <Input
                id="inv-name"
                name="name"
                placeholder="Ej: Plazo fijo Galicia, BTC, MELI"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-type">Tipo *</Label>
                <Select
                  id="inv-type"
                  name="type"
                  defaultValue="FIXED_TERM"
                  required
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {TYPE_ICONS[v]} {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-currency">Moneda *</Label>
                <Select
                  id="inv-currency"
                  name="currency"
                  defaultValue="ARS"
                  required
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-amount">Monto invertido *</Label>
                <Input
                  id="inv-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-current">Valor actual</Label>
                <Input
                  id="inv-current"
                  name="currentValue"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-ticker">Ticker / símbolo</Label>
                <Input
                  id="inv-ticker"
                  name="ticker"
                  placeholder="MELI, BTC..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-units">Unidades</Label>
                <Input
                  id="inv-units"
                  name="units"
                  type="number"
                  step="any"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Fecha de compra *</Label>
              <Input
                id="inv-date"
                name="purchaseDate"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notas</Label>
              <Textarea
                id="inv-notes"
                name="notes"
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
