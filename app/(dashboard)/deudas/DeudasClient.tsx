"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, HandCoins, DollarSign, TrendingDown, TrendingUp, ListChecks, AlertTriangle, Clock, CheckCircle2, Info, CalendarClock } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createDebtAction,
  payDebtAction,
  deleteDebtAction,
} from "@/app/actions/debts";
import type { SerializedDebt } from "@/lib/db/debts";

interface Props {
  initialDebts: SerializedDebt[];
}

export function DeudasClient({ initialDebts }: Props) {
  const [debts, setDebts] = useState<SerializedDebt[]>(initialDebts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [payingDebt, setPayingDebt] = useState<SerializedDebt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const iOwe = debts.filter((d) => d.direction === "I_OWE" && !d.isCompleted);
  const theyOwe = debts.filter(
    (d) => d.direction === "THEY_OWE" && !d.isCompleted
  );
  const completed = debts.filter((d) => d.isCompleted);

  const totalIOwe = iOwe.reduce((s, d) => s + d.remainingAmount, 0);
  const totalTheyOwe = theyOwe.reduce((s, d) => s + d.remainingAmount, 0);

  // Alertas y próximos vencimientos (deudas que debo, con fecha)
  const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const withDue = iOwe.filter((d) => d.dueDate);
  const overdue = withDue.filter((d) => daysTo(d.dueDate!) < 0);
  const upcoming = withDue
    .filter((d) => daysTo(d.dueDate!) >= 0)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const goodProgress = iOwe.find((d) => d.totalAmount > 0 && d.paidAmount / d.totalAmount >= 0.5);

  const alerts: { type: "danger" | "warning" | "success" | "info"; title: string; body: string }[] = [];
  if (overdue.length) {
    alerts.push({ type: "danger", title: "Pago atrasado", body: `Tenés ${overdue.length} deuda${overdue.length !== 1 ? "s" : ""} vencida${overdue.length !== 1 ? "s" : ""} por ${formatCurrency(overdue.reduce((s, d) => s + d.remainingAmount, 0), "ARS")}.` });
  }
  const soon = upcoming.filter((d) => daysTo(d.dueDate!) <= 7);
  if (soon.length) {
    alerts.push({ type: "warning", title: "Vence pronto", body: `${soon[0].personName} vence en ${daysTo(soon[0].dueDate!)} día${daysTo(soon[0].dueDate!) !== 1 ? "s" : ""}.` });
  }
  if (goodProgress) {
    alerts.push({ type: "success", title: "Buen progreso", body: `Ya pagaste más de la mitad de ${goodProgress.personName}. ¡Seguí así!` });
  }
  if (!alerts.length) {
    alerts.push({ type: "info", title: "Todo en orden", body: "No tenés pagos atrasados ni vencimientos próximos." });
  }
  const ALERT_ICON = { danger: AlertTriangle, warning: Clock, success: CheckCircle2, info: Info };
  const ALERT_COLOR = { danger: "text-danger", warning: "text-warning", success: "text-success", info: "text-primary" };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createDebtAction(formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.debt) {
        setDebts((prev) => [result.debt!, ...prev]);
        setIsCreateOpen(false);
        toast.success("Deuda registrada");
      }
    });
  };

  const handlePay = () => {
    if (!payingDebt) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    startTransition(async () => {
      const result = await payDebtAction(payingDebt.id, amount);
      if (result.error) toast.error(result.error);
      else if (result.success && result.debt) {
        setDebts((prev) =>
          prev.map((d) => (d.id === result.debt!.id ? result.debt! : d))
        );
        setPayingDebt(null);
        setPayAmount("");
        toast.success(
          result.debt.isCompleted ? "Deuda saldada 🎉" : "Pago registrado"
        );
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteDebtAction(id);
      if (result.error) toast.error(result.error);
      else {
        setDebts((prev) => prev.filter((d) => d.id !== id));
        toast.success("Deuda eliminada");
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Deudas"
        subtitle="Organizá tus deudas y seguí tu plan de pago."
        actions={
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} className="mr-1.5" />
            Nueva deuda
          </Button>
        }
      />

      {/* KPIs */}
      {(iOwe.length > 0 || theyOwe.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total que debo" value={formatCurrency(totalIOwe, "ARS")} hint={`${iOwe.length} deuda${iOwe.length !== 1 ? "s" : ""}`} icon={TrendingDown} accent="danger" />
          <StatCard label="Me deben" value={formatCurrency(totalTheyOwe, "ARS")} hint={`${theyOwe.length} a favor`} icon={TrendingUp} accent="success" />
          <StatCard label="Deudas activas" value={iOwe.length + theyOwe.length} hint={completed.length > 0 ? `${completed.length} saldada${completed.length !== 1 ? "s" : ""}` : undefined} icon={ListChecks} accent="primary" />
        </div>
      )}

      {/* Plan de cancelación (bola de nieve) */}
      {iOwe.length > 1 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Plan de cancelación</p>
            <p className="text-xs text-muted mb-4">Orden sugerido (bola de nieve): saldá primero las deudas más chicas para ganar impulso.</p>
            <div className="flex items-start gap-1 overflow-x-auto pb-2">
              {[...iOwe].sort((a, b) => a.remainingAmount - b.remainingAmount).map((d, i, arr) => (
                <div key={d.id} className="flex items-start gap-1 shrink-0">
                  <div className="flex flex-col items-center gap-2 w-32">
                    <span className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">{i + 1}</span>
                    <div className="rounded-xl border border-border bg-surface-2/50 p-2.5 text-center w-full">
                      <p className="text-xs font-medium text-foreground truncate">{d.personName}</p>
                      <p className="text-sm font-bold font-mono text-danger mt-0.5">{formatCurrency(d.remainingAmount, d.currency)}</p>
                    </div>
                  </div>
                  <div className="w-5 h-0.5 bg-border mt-4" />
                  {i === arr.length - 1 && (
                    <div className="flex flex-col items-center gap-2 w-32">
                      <span className="w-8 h-8 rounded-full bg-success/15 text-success flex items-center justify-center text-base">🏆</span>
                      <div className="rounded-xl border border-success/30 bg-success/5 p-2.5 text-center w-full">
                        <p className="text-xs font-semibold text-success">Libre de deudas</p>
                        <p className="text-[11px] text-muted mt-0.5">{formatCurrency(totalIOwe, "ARS")} total</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <EmptyState
          icon={HandCoins}
          title="Sin deudas registradas"
          description="Registrá plata que debés o que te deben para hacer seguimiento."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Nueva deuda
            </Button>
          }
        />
      )}

      {/* Detalle de deudas + aside */}
      {(iOwe.length > 0 || theyOwe.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
          {/* Tabla — desktop */}
          <Card className="hidden md:block">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Detalle de deudas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted border-b border-border">
                      <th className="text-left font-medium py-2.5 px-2">Persona</th>
                      <th className="text-left font-medium py-2.5 px-2">Tipo</th>
                      <th className="text-right font-medium py-2.5 px-2">Total</th>
                      <th className="text-right font-medium py-2.5 px-2">Pagado</th>
                      <th className="text-right font-medium py-2.5 px-2">Restante</th>
                      <th className="text-left font-medium py-2.5 px-2 pl-4">Progreso</th>
                      <th className="py-2.5 px-2 w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...iOwe, ...theyOwe].map((d) => {
                      const isOwe = d.direction === "I_OWE";
                      const pct = d.totalAmount > 0 ? Math.round((d.paidAmount / d.totalAmount) * 100) : 0;
                      return (
                        <tr key={d.id} className="border-b border-border-subtle hover:bg-surface-2/40 group">
                          <td className="py-2.5 px-2">
                            <span className="font-medium text-foreground">{d.personName}</span>
                            {d.description && <span className="block text-xs text-muted truncate max-w-[180px]">{d.description}</span>}
                          </td>
                          <td className="py-2.5 px-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOwe ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                              {isOwe ? "Les debo" : "Me deben"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-muted">{formatCurrency(d.totalAmount, d.currency)}</td>
                          <td className="py-2.5 px-2 text-right font-mono text-success">{formatCurrency(d.paidAmount, d.currency)}</td>
                          <td className={`py-2.5 px-2 text-right font-mono font-bold ${isOwe ? "text-danger" : "text-success"}`}>{formatCurrency(d.remainingAmount, d.currency)}</td>
                          <td className="py-2.5 px-2 pl-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                              <span className="text-xs text-muted">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setPayingDebt(d); setPayAmount(""); }} className="text-xs font-medium px-2 py-1 rounded-lg text-primary hover:bg-primary/10">Pago</button>
                              <button onClick={() => handleDelete(d.id)} disabled={deletingId === d.id || isPending} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-6">
            {iOwe.length > 0 && (
              <DebtGroup title="Les debo" debts={iOwe} accent="text-danger" onPay={(d) => { setPayingDebt(d); setPayAmount(""); }} onDelete={handleDelete} deletingId={deletingId} isPending={isPending} />
            )}
            {theyOwe.length > 0 && (
              <DebtGroup title="Me deben" debts={theyOwe} accent="text-success" onPay={(d) => { setPayingDebt(d); setPayAmount(""); }} onDelete={handleDelete} deletingId={deletingId} isPending={isPending} />
            )}
          </div>
          </div>

          {/* Aside: alertas + próximos vencimientos */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-foreground mb-3">Alertas y recomendaciones</p>
                <div className="space-y-3">
                  {alerts.map((a, i) => {
                    const Icon = ALERT_ICON[a.type];
                    const color = ALERT_COLOR[a.type];
                    return (
                      <div key={i} className="flex gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2 ${color}`}><Icon size={15} /></span>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${color}`}>{a.title}</p>
                          <p className="text-xs text-muted mt-0.5 leading-snug">{a.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {upcoming.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <CalendarClock size={15} className="text-muted" /> Próximos vencimientos
                  </p>
                  <div className="space-y-2.5">
                    {upcoming.slice(0, 5).map((d) => {
                      const dd = daysTo(d.dueDate!);
                      return (
                        <div key={d.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{d.personName}</p>
                            <p className="text-[11px] text-muted">{dd === 0 ? "Vence hoy" : `Vence en ${dd}d`}</p>
                          </div>
                          <p className="text-sm font-bold font-mono text-danger shrink-0">{formatCurrency(d.remainingAmount, d.currency)}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Saldadas ({completed.length})
          </p>
          {completed.map((d) => (
            <Card key={d.id} className="group opacity-60">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground line-through">
                    {d.personName}
                  </p>
                  <p className="text-xs text-muted">
                    {formatCurrency(d.totalAmount, d.currency)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id || isPending}
                  className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent title="Nueva deuda">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Dirección *</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "I_OWE", label: "💸 Les debo" },
                  { value: "THEY_OWE", label: "💰 Me deben" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 p-3 rounded-xl border border-border cursor-pointer hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all"
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={opt.value}
                      defaultChecked={opt.value === "I_OWE"}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-person">Persona *</Label>
              <Input
                id="debt-person"
                name="personName"
                placeholder="Nombre de la persona"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-desc">Descripción</Label>
              <Input
                id="debt-desc"
                name="description"
                placeholder="Ej: Alquiler de enero, préstamo..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="debt-amount">Monto *</Label>
                <Input
                  id="debt-amount"
                  name="totalAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="debt-currency">Moneda</Label>
                <Select id="debt-currency" name="currency" defaultValue="ARS">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Vencimiento</Label>
              <Input id="debt-due" name="dueDate" type="date" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsCreateOpen(false)}
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

      {/* Pay dialog */}
      {payingDebt && (
        <Dialog open={!!payingDebt} onOpenChange={() => setPayingDebt(null)}>
          <DialogContent title={`Registrar pago — ${payingDebt.personName}`}>
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(payingDebt.totalAmount, payingDebt.currency)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted">Pendiente</span>
                  <span className="font-mono font-semibold text-danger">
                    {formatCurrency(
                      payingDebt.remainingAmount,
                      payingDebt.currency
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Monto del pago *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Hasta ${payingDebt.remainingAmount.toFixed(2)}`}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setPayingDebt(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handlePay}
                  disabled={isPending}
                >
                  {isPending ? "Guardando..." : "Registrar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DebtGroup({
  title,
  debts,
  accent,
  onPay,
  onDelete,
  deletingId,
  isPending,
}: {
  title: string;
  debts: SerializedDebt[];
  accent: string;
  onPay: (d: SerializedDebt) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">
        {title}
      </p>
      {debts.map((d) => {
        const pct =
          d.totalAmount > 0
            ? Math.round((d.paidAmount / d.totalAmount) * 100)
            : 0;
        return (
          <Card key={d.id} className="group">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {d.personName}
                  </p>
                  {d.description && (
                    <p className="text-xs text-muted truncate">
                      {d.description}
                    </p>
                  )}
                  {d.dueDate && (
                    <p className="text-xs text-muted">
                      Vence {formatDate(d.dueDate)}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold font-mono ${accent}`}>
                    {formatCurrency(d.remainingAmount, d.currency)}
                  </p>
                  <p className="text-xs text-muted">
                    de {formatCurrency(d.totalAmount, d.currency)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{pct}% pagado</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onPay(d)}
                    disabled={isPending}
                    className="h-7 px-2 text-xs"
                  >
                    <DollarSign size={12} className="mr-1" />
                    Pagar
                  </Button>
                  <button
                    onClick={() => onDelete(d.id)}
                    disabled={deletingId === d.id || isPending}
                    className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
