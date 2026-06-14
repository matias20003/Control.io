"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createTransactionAction } from "@/app/actions/transactions";
import { createCategoryAction } from "@/app/actions/categories";
import { formatCurrency } from "@/lib/utils";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

interface Props {
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
}

export function DashboardQuickAdd({ accounts, categories }: Props) {
  const [isOpen, setIsOpen]         = useState(false);
  const [txType, setTxType]         = useState<TxType>("EXPENSE");
  const [isPending, startTransition] = useTransition();
  const [formKey,      setFormKey]   = useState(0);
  const [lastDefaults, setLastDefaults] = useState<{
    accountId?: string; currency?: string; date?: string; categoryId?: string;
  }>({});

  const openModal = (type: TxType) => { setTxType(type); setIsOpen(true); };

  // Permite que otros componentes (ej: MovementPrompt) abran el modal disparando
  // un CustomEvent en el window. Evita acoplar componentes vía props/refs.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: TxType }>).detail;
      openModal(detail?.type ?? "EXPENSE");
    };
    window.addEventListener("dashboard:open-quick-add", handler);
    return () => window.removeEventListener("dashboard:open-quick-add", handler);
  }, []);

  const filteredCategories = categories.filter((c) => c.type === txType);

  const handleCreate = (formData: FormData) => {
    if (txType === "TRANSFER") {
      const from = formData.get("accountId");
      const to = formData.get("toAccountId");
      if (!from || !to) { toast.error("Elegí las cuentas de origen y destino"); return; }
      if (from === to) { toast.error("La cuenta de origen y la de destino deben ser distintas"); return; }
    }
    const saveAction = formData.get("save_action") as string;
    startTransition(async () => {
      const result = await createTransactionAction(formData);
      if (result.error) { toast.error(result.error); return; }
      const labels: Record<TxType, string> = {
        INCOME: "Ingreso registrado ✓",
        EXPENSE: "Gasto registrado ✓",
        TRANSFER: "Transferencia registrada ✓",
      };
      // Mostramos el saldo nuevo en el toast para que el usuario tenga
      // feedback inmediato del impacto de la operación.
      const description = result.newBalance != null && result.accountCurrency
        ? `Saldo: ${formatCurrency(result.newBalance, result.accountCurrency)}`
        : undefined;
      toast.success(labels[txType], description ? { description } : undefined);
      if (saveAction === "save_and_another") {
        setLastDefaults({
          accountId:  formData.get("accountId")  as string || undefined,
          currency:   formData.get("currency")   as string || undefined,
          date:       formData.get("date")       as string || undefined,
          categoryId: formData.get("categoryId") as string || undefined,
        });
        setFormKey((k) => k + 1);
      } else {
        setIsOpen(false);
        setLastDefaults({});
      }
    });
  };

  /* ── Formulario reutilizable ── */
  const QuickForm = () => {
    const [showMore, setShowMore] = useState(false);
    // Crear categoría inline (queda en estado local del form, no remonta).
    const [extraCats, setExtraCats] = useState<SerializedCategory[]>([]);
    const [catId, setCatId] = useState(lastDefaults.categoryId ?? "");
    const [addingCat, setAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [newCatIcon, setNewCatIcon] = useState("");
    const [creatingCat, setCreatingCat] = useState(false);
    const allCats = [...filteredCategories, ...extraCats.filter((c) => c.type === txType)];

    const createCat = async () => {
      if (!newCatName.trim() || txType === "TRANSFER") return;
      setCreatingCat(true);
      const fd = new FormData();
      fd.set("name", newCatName.trim());
      fd.set("type", txType);
      if (newCatIcon.trim()) fd.set("icon", newCatIcon.trim());
      const res = await createCategoryAction(fd);
      setCreatingCat(false);
      if ("category" in res && res.category) {
        setExtraCats((prev) => [...prev, res.category as SerializedCategory]);
        setCatId(res.category.id);
        setAddingCat(false);
        setNewCatName("");
        setNewCatIcon("");
        toast.success("Categoría creada ✓");
      } else {
        toast.error("error" in res && res.error ? res.error : "No se pudo crear la categoría");
      }
    };
    return (
      <>
        <div className="flex rounded-xl overflow-hidden border border-border mb-5">
          {(["EXPENSE", "INCOME", "TRANSFER"] as TxType[]).map((t) => (
            <button key={t} type="button" onClick={() => setTxType(t)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                txType === t
                  ? t === "EXPENSE" ? "bg-danger text-white" : t === "INCOME" ? "bg-success text-white" : "bg-primary text-background"
                  : "bg-surface text-muted hover:text-foreground"
              }`}>
              {t === "EXPENSE" ? "Gasto" : t === "INCOME" ? "Ingreso" : "Transferencia"}
            </button>
          ))}
        </div>

        <form action={handleCreate} className="space-y-4">
          <input type="hidden" name="type" value={txType} />
          {!showMore && (
            <input type="hidden" name="currency" value={lastDefaults.currency ?? "ARS"} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="dqa-amount">Monto *</Label>
            <Input id="dqa-amount" name="amount" type="number" step="0.01" min="0.01"
              placeholder="0.00" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dqa-date">Fecha</Label>
            <Input id="dqa-date" name="date" type="date"
              defaultValue={lastDefaults.date ?? new Date().toISOString().split("T")[0]} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dqa-description">Descripción</Label>
            <Input id="dqa-description" name="description" placeholder="Ej: Supermercado, almuerzo..." />
          </div>

          {txType !== "TRANSFER" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="dqa-category">Categoría</Label>
                <button type="button" onClick={() => setAddingCat((v) => !v)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                  {addingCat ? "Cancelar" : <><Plus size={12} /> Nueva</>}
                </button>
              </div>
              {addingCat ? (
                <>
                  <div className="flex gap-2">
                    <Input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} maxLength={2} placeholder="🍔" className="w-14 text-center" />
                    <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                      placeholder={`Categoría de ${txType === "INCOME" ? "ingreso" : "gasto"}`} className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCat(); } }} />
                    <Button type="button" variant="secondary" className="shrink-0" disabled={creatingCat || !newCatName.trim()} onClick={createCat}>
                      {creatingCat ? "..." : "Crear"}
                    </Button>
                  </div>
                  <input type="hidden" name="categoryId" value={catId} />
                </>
              ) : (
                <Select id="dqa-category" name="categoryId" value={catId} onChange={(e) => setCatId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {allCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {txType !== "TRANSFER" ? (
            <div className="space-y-1.5">
              <Label htmlFor="dqa-account">Cuenta {accounts.length > 0 ? "*" : ""}</Label>
              <Select id="dqa-account" name="accountId" defaultValue={lastDefaults.accountId ?? accounts[0]?.id ?? ""} required={accounts.length > 0}>
                <option value="" disabled={accounts.length > 0}>{accounts.length > 0 ? "Seleccioná una cuenta" : "Sin cuenta"}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dqa-from">Desde *</Label>
                <Select id="dqa-from" name="accountId" defaultValue="" required>
                  <option value="">Seleccionar</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dqa-to">Hacia *</Label>
                <Select id="dqa-to" name="toAccountId" defaultValue="" required>
                  <option value="">Seleccionar</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            </div>
          )}

          {/* Más opciones — moneda y notas */}
          <button type="button" onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
            {showMore ? "Menos opciones" : "Más opciones"}
          </button>

          {showMore && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dqa-currency">Moneda</Label>
                <Select id="dqa-currency" name="currency" defaultValue={lastDefaults.currency ?? "ARS"}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dqa-notes">Notas</Label>
                <Textarea id="dqa-notes" name="notes" placeholder="Notas adicionales..." rows={2} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-shrink-0 px-3"
              onClick={() => { setIsOpen(false); setLastDefaults({}); }}>
              Cancelar
            </Button>
            <Button type="submit" name="save_action" value="save_and_another"
              variant="outline" className="flex-1" disabled={isPending}>
              + Otro
            </Button>
            <Button type="submit" name="save_action" value="save" className="flex-1" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </>
    );
  };

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="income" onClick={() => openModal("INCOME")} className="w-full">
            <ArrowDownLeft size={15} />Nuevo ingreso
          </Button>
          <Button variant="expense" onClick={() => openModal("EXPENSE")} className="w-full">
            <ArrowUpRight size={15} />Nuevo gasto
          </Button>
        </div>
        <button onClick={() => openModal("TRANSFER")}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-2 hover:text-primary transition-colors py-1">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-surface-2 text-muted group-hover:bg-primary/15 group-hover:text-primary transition-colors">
            <ArrowLeftRight size={11} />
          </span>
          Nueva transferencia
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setIsOpen(false); setLastDefaults({}); } }}>
        <DialogContent title="Nuevo movimiento">
          <QuickForm key={formKey} />
        </DialogContent>
      </Dialog>
    </>
  );
}
