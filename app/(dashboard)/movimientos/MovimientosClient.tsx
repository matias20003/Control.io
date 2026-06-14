"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Trash2,
  Pencil,
  Receipt,
  Search,
  X,
  Download,
  Upload,
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
} from "lucide-react";
import { createCategoryAction } from "@/app/actions/categories";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { DailyFlowChart, ActivityHeatmap } from "./MovimientosCharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  getTransactionsAction,
} from "@/app/actions/transactions";
import type { SerializedTransaction } from "@/lib/db/transactions";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

const TYPE_CONFIG: Record<TxType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  INCOME:   { label: "Ingreso",        icon: ArrowDownLeft,  color: "text-success", bg: "bg-success/10" },
  EXPENSE:  { label: "Gasto",          icon: ArrowUpRight,   color: "text-danger",  bg: "bg-danger/10"  },
  TRANSFER: { label: "Transferencia",  icon: ArrowLeftRight, color: "text-primary", bg: "bg-primary/10" },
};

interface Props {
  initialTransactions: SerializedTransaction[];
  initialTotal: number;
  initialHasMore: boolean;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  initialMonth: number;
  initialYear: number;
}

export function MovimientosClient({ initialTransactions, initialTotal, initialHasMore, accounts, categories, initialMonth, initialYear }: Props) {
  const now = new Date();
  const [month, setMonth]             = useState(initialMonth);
  const [year, setYear]               = useState(initialYear);
  const [transactions, setTransactions] = useState<SerializedTransaction[]>(initialTransactions);
  const [total, setTotal]             = useState(initialTotal);
  const [hasMore, setHasMore]         = useState(initialHasMore);
  const [filterType, setFilterType]   = useState<string>("ALL");
  const [filterAccountId, setFilterAccountId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create dialog
  const [isOpen, setIsOpen]           = useState(false);
  const [txType, setTxType]           = useState<TxType>("EXPENSE");

  // Edit dialog
  const [editingTx, setEditingTx]     = useState<SerializedTransaction | null>(null);
  const [editType, setEditType]       = useState<TxType>("EXPENSE");

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // CSV import
  const [importOpen, setImportOpen] = useState(false);

  // Abrir el import directo cuando se llega con ?import=1 (ej: banner "actualizá tus movimientos").
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("import") === "1") setImportOpen(true);
  }, [searchParams]);

  const [isPending, startTransition]  = useTransition();

  // Batch entry: remember last-used context so "guardar y otro" pre-fills form
  const [formKey,      setFormKey]      = useState(0);
  const [lastDefaults, setLastDefaults] = useState<{
    accountId?: string; currency?: string; date?: string; categoryId?: string;
  }>({});

  const openCreate = (type: TxType) => { setTxType(type); setIsOpen(true); };
  const openEdit   = (tx: SerializedTransaction) => {
    setEditingTx(tx);
    setEditType((tx.type as TxType) || "EXPENSE");
  };

  const filteredCategories     = categories.filter((c) => c.type === txType);
  const filteredCategoriesEdit = categories.filter((c) => c.type === editType);

  // Navigate months
  const navigate = (delta: number) => {
    let newMonth = month + delta;
    let newYear  = year;
    if (newMonth < 1)  { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1;  newYear++; }
    setMonth(newMonth);
    setYear(newYear);
    startTransition(async () => {
      const page = await getTransactionsAction(newMonth, newYear);
      setTransactions(page.items);
      setTotal(page.total);
      setHasMore(page.hasMore);
    });
  };

  const loadMore = () => {
    startTransition(async () => {
      const page = await getTransactionsAction(month, year, { skip: transactions.length });
      setTransactions((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    });
  };

  // Filtered + searched transactions
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (filterType !== "ALL" && tx.type !== filterType) return false;
      if (filterAccountId !== "ALL" && tx.accountId !== filterAccountId) return false;
      if (q) {
        const haystack = [tx.description, tx.notes, tx.categoryName, tx.accountName, tx.toAccountName]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterAccountId, searchQuery]);

  const totalIncome  = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const balanceNeto  = totalIncome - totalExpense;

  // Serie diaria del mes (para el gráfico de flujo neto)
  const daily = useMemo(() => {
    const map = new Map<number, { income: number; expense: number }>();
    for (const t of transactions) {
      if (t.type === "TRANSFER") continue;
      const d = new Date(t.date).getDate();
      const e = map.get(d) ?? { income: 0, expense: 0 };
      if (t.type === "INCOME") e.income += t.amount;
      else e.expense += t.amount;
      map.set(d, e);
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const e = map.get(i + 1) ?? { income: 0, expense: 0 };
      return { day: String(i + 1), income: e.income, expense: e.expense, net: e.income - e.expense };
    });
  }, [transactions, month, year]);

  // Handlers
  const handleCreate = (formData: FormData) => {
    const saveAction = formData.get("save_action") as string;
    startTransition(async () => {
      const result = await createTransactionAction(formData);
      if (result.error) { toast.error(result.error); return; }
      if (result.success && result.transaction) {
        const tx = result.transaction;
        const txDate = new Date(tx.date);
        if (txDate.getMonth() + 1 === month && txDate.getFullYear() === year) {
          setTransactions((prev) => [tx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        toast.success(`${TYPE_CONFIG[tx.type as TxType]?.label ?? "Movimiento"} registrado ✓`);
        if (saveAction === "save_and_another") {
          // Stay open — reset form but carry over account/currency/date/category
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
      }
    });
  };

  const handleUpdate = (formData: FormData) => {
    if (!editingTx) return;
    startTransition(async () => {
      const result = await updateTransactionAction(editingTx.id, formData);
      if (result.error) { toast.error(result.error); return; }
      if (result.success && result.transaction) {
        setTransactions((prev) =>
          prev.map((t) => t.id === editingTx.id ? result.transaction! : t)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
        setEditingTx(null);
        toast.success("Movimiento actualizado ✓");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteTransactionAction(id);
      if (result.error) { toast.error(result.error); return; }
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setConfirmDeleteId(null);
      toast.success("Movimiento eliminado");
    });
  };

  // Reusable form fields for create/edit
  const TxForm = ({
    onSubmit, type, setType, cats, defaultValues, submitLabel, showAddAnother,
  }: {
    onSubmit: (fd: FormData) => void;
    type: TxType;
    setType: (t: TxType) => void;
    cats: typeof filteredCategories;
    defaultValues?: Partial<SerializedTransaction> & { categoryId?: string | null };
    submitLabel: string;
    showAddAnother?: boolean;
  }) => {
    // Auto-expand "más opciones" when editing a non-ARS tx or one with notes
    const [showMore, setShowMore] = useState(
      !!(defaultValues?.notes || (defaultValues?.currency && defaultValues.currency !== "ARS"))
    );
    // Crear categoría inline: la nueva queda en estado LOCAL del form para no
    // remontarlo (no se pierde lo ya tipeado). Se persiste igual en la BD.
    const [extraCats, setExtraCats] = useState<SerializedCategory[]>([]);
    const [catId, setCatId] = useState(defaultValues?.categoryId ?? "");
    const [addingCat, setAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [newCatIcon, setNewCatIcon] = useState("");
    const [creatingCat, setCreatingCat] = useState(false);
    const allCats = [...cats, ...extraCats.filter((c) => c.type === type)];

    const createCat = async () => {
      if (!newCatName.trim() || type === "TRANSFER") return;
      setCreatingCat(true);
      const fd = new FormData();
      fd.set("name", newCatName.trim());
      fd.set("type", type);
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
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                type === t
                  ? t === "EXPENSE" ? "bg-danger text-white" : t === "INCOME" ? "bg-success text-white" : "bg-primary text-background"
                  : "bg-surface text-muted hover:text-foreground"
              }`}>
              {t === "EXPENSE" ? "Gasto" : t === "INCOME" ? "Ingreso" : "Transferencia"}
            </button>
          ))}
        </div>
        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          {/* Currency: hidden input when collapsed, visible select when expanded */}
          {!showMore && (
            <input type="hidden" name="currency" value={defaultValues?.currency ?? "ARS"} />
          )}

          {/* Monto — autofocus para tipear directo al abrir */}
          <div className="space-y-1.5">
            <Label htmlFor="f-amount">Monto *</Label>
            <Input id="f-amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00"
              defaultValue={defaultValues?.amount ?? ""} required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-date">Fecha</Label>
            <Input id="f-date" name="date" type="date"
              defaultValue={defaultValues?.date ? defaultValues.date.split("T")[0] : new Date().toISOString().split("T")[0]}
              required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-description">Descripción</Label>
            <Input id="f-description" name="description" placeholder="Ej: Supermercado, almuerzo..."
              defaultValue={defaultValues?.description ?? ""} />
          </div>

          {type !== "TRANSFER" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="f-category">Categoría</Label>
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
                      placeholder={`Categoría de ${type === "INCOME" ? "ingreso" : "gasto"}`} className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCat(); } }} />
                    <Button type="button" variant="secondary" className="shrink-0" disabled={creatingCat || !newCatName.trim()} onClick={createCat}>
                      {creatingCat ? "..." : "Crear"}
                    </Button>
                  </div>
                  <input type="hidden" name="categoryId" value={catId} />
                </>
              ) : (
                <Select id="f-category" name="categoryId" value={catId} onChange={(e) => setCatId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {allCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </Select>
              )}
            </div>
          )}

          {type !== "TRANSFER" ? (
            <div className="space-y-1.5">
              <Label htmlFor="f-account">Cuenta {accounts.length > 0 ? "*" : ""}</Label>
              <Select id="f-account" name="accountId" defaultValue={defaultValues?.accountId ?? ""} required={accounts.length > 0}>
                <option value="" disabled={accounts.length > 0}>{accounts.length > 0 ? "Seleccioná una cuenta" : "Sin cuenta"}</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-from">Desde *</Label>
                <Select id="f-from" name="accountId" defaultValue={defaultValues?.accountId ?? ""}>
                  <option value="">Seleccionar</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-to">Hacia *</Label>
                <Select id="f-to" name="toAccountId" defaultValue={defaultValues?.toAccountId ?? ""}>
                  <option value="">Seleccionar</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            </div>
          )}

          {/* Más opciones — moneda y notas colapsadas */}
          <button type="button" onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
            <ChevronDown size={13} className={`transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
            {showMore ? "Menos opciones" : "Más opciones"}
          </button>

          {showMore && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="f-currency">Moneda</Label>
                <Select id="f-currency" name="currency" defaultValue={defaultValues?.currency ?? "ARS"}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-notes">Notas</Label>
                <Textarea id="f-notes" name="notes" placeholder="Notas adicionales..." rows={2}
                  defaultValue={defaultValues?.notes ?? ""} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-shrink-0 px-3"
              onClick={() => { setIsOpen(false); setEditingTx(null); }}>
              Cancelar
            </Button>
            {showAddAnother && (
              <Button type="submit" name="save_action" value="save_and_another"
                variant="outline" className="flex-1" disabled={isPending}>
                + Otro
              </Button>
            )}
            <Button type="submit" name="save_action" value="save" className="flex-1" disabled={isPending}>
              {isPending ? "Guardando..." : submitLabel}
            </Button>
          </div>
        </form>
      </>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <PageHeader
        title="Movimientos"
        subtitle="Registrá, consultá y controlá todos tus movimientos financieros."
      />

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Nuevo ingreso", icon: ArrowDownLeft, cls: "bg-success/10 text-success", on: () => openCreate("INCOME") },
          { label: "Nuevo gasto", icon: ArrowUpRight, cls: "bg-danger/10 text-danger", on: () => openCreate("EXPENSE") },
          { label: "Transferencia", icon: ArrowLeftRight, cls: "bg-primary/10 text-primary", on: () => openCreate("TRANSFER") },
          { label: "Importar CSV", icon: Upload, cls: "bg-violet-500/10 text-violet-500", on: () => setImportOpen(true) },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.on}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface hover:border-primary hover:bg-surface-2 transition-colors p-3.5 text-left"
          >
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${b.cls}`}>
              <b.icon size={18} />
            </span>
            <span className="text-sm font-semibold text-foreground">{b.label}</span>
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} disabled={isPending}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-foreground">
          {formatMonth(month, year)}
        </span>
        <button onClick={() => navigate(1)}
          disabled={isPending || (month === now.getMonth() + 1 && year === now.getFullYear())}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
        <a
          href={`/api/export/transactions?month=${month}&year=${year}`}
          download
          title="Exportar CSV"
          className="p-1.5 rounded-lg border border-border text-muted hover:text-primary hover:border-primary transition-colors"
        >
          <Download size={16} />
        </a>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Ingresos del mes" value={formatCurrency(totalIncome, "ARS")} icon={TrendingUp} accent="success" />
        <StatCard label="Gastos del mes" value={formatCurrency(totalExpense, "ARS")} icon={TrendingDown} accent="danger" />
        <StatCard label="Balance neto" value={formatCurrency(balanceNeto, "ARS")} icon={Scale} accent={balanceNeto >= 0 ? "primary" : "danger"} />
      </div>

      {/* Flujo diario + actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Flujo neto diario</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-success" /> Ingresos</span>
                <span className="flex items-center gap-1.5 text-muted"><span className="w-2.5 h-2.5 rounded-sm bg-danger" /> Gastos</span>
                <span className="flex items-center gap-1.5 text-muted"><span className="w-3 h-0.5 rounded-sm bg-primary" /> Neto</span>
              </div>
            </div>
            <DailyFlowChart data={daily} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Actividad por día</p>
            <ActivityHeatmap data={daily} month={month} year={year} />
            <div className="flex items-center justify-end gap-3 mt-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success" /> Día positivo</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-danger" /> Día negativo</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de movimientos */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm font-semibold text-foreground">Historial de movimientos</p>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar movimiento, categoría, cuenta…"
                className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-surface-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 flex-wrap mb-4">
            {(["ALL", "INCOME", "EXPENSE", "TRANSFER"] as const).map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterType === t ? "bg-primary text-background" : "bg-surface-2 text-muted hover:text-foreground"
                }`}>
                {t === "ALL" ? "Todos" : t === "INCOME" ? "Ingresos" : t === "EXPENSE" ? "Gastos" : "Transferencias"}
              </button>
            ))}
            {accounts.length > 0 && (
              <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-surface-2 text-muted border-none outline-none cursor-pointer">
                <option value="ALL">Todas las cuentas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Receipt} title="Sin movimientos"
              description={searchQuery ? `No hay resultados para "${searchQuery}".`
                : filterType === "ALL" && filterAccountId === "ALL"
                ? "Registrá ingresos, gastos o transferencias para este mes."
                : "No hay movimientos con los filtros seleccionados."}
              action={!searchQuery && filterType === "ALL" && filterAccountId === "ALL" ? (
                <div className="flex gap-2">
                  <Button variant="income" onClick={() => openCreate("INCOME")}><ArrowDownLeft size={15} />Ingreso</Button>
                  <Button variant="expense"  onClick={() => openCreate("EXPENSE")}><ArrowUpRight  size={15} />Gasto</Button>
                </div>
              ) : undefined}
            />
          ) : (
            <>
              {/* Tabla — desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted border-b border-border">
                      <th className="text-left font-medium py-2.5 px-2">Movimiento</th>
                      <th className="text-left font-medium py-2.5 px-2">Tipo</th>
                      <th className="text-left font-medium py-2.5 px-2">Categoría</th>
                      <th className="text-left font-medium py-2.5 px-2">Fecha</th>
                      <th className="text-left font-medium py-2.5 px-2">Cuenta</th>
                      <th className="text-right font-medium py-2.5 px-2">Monto</th>
                      <th className="py-2.5 px-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx) => {
                      const cfg = TYPE_CONFIG[tx.type as TxType];
                      const Icon = cfg?.icon ?? Receipt;
                      const isExpense = tx.type === "EXPENSE";
                      const isTransfer = tx.type === "TRANSFER";
                      return (
                        <tr key={tx.id} className="border-b border-border-subtle hover:bg-surface-2/40 group">
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg?.bg ?? "bg-surface-2"}`}>
                                {tx.categoryIcon ? <span className="text-sm">{tx.categoryIcon}</span> : <Icon size={14} className={cfg?.color ?? "text-muted"} />}
                              </span>
                              <span className="font-medium text-foreground truncate max-w-[200px]">{tx.description || tx.categoryName || cfg?.label}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2"><span className={`text-xs font-medium ${cfg?.color ?? "text-muted"}`}>{cfg?.label}</span></td>
                          <td className="py-2.5 px-2 text-muted">{tx.categoryName || "—"}</td>
                          <td className="py-2.5 px-2 text-muted whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="py-2.5 px-2 text-muted truncate max-w-[140px]">{tx.accountName || "—"}{isTransfer && tx.toAccountName ? ` → ${tx.toAccountName}` : ""}</td>
                          <td className={`py-2.5 px-2 text-right font-bold font-mono whitespace-nowrap ${isExpense ? "text-danger" : isTransfer ? "text-primary" : "text-success"}`}>
                            {isExpense ? "−" : isTransfer ? "" : "+"}{formatCurrency(tx.amount, tx.currency)}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10"><Pencil size={13} /></button>
                              <button onClick={() => setConfirmDeleteId(tx.id)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="md:hidden space-y-2">
                {filtered.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.type as TxType];
                  const Icon = cfg?.icon ?? Receipt;
                  const isExpense = tx.type === "EXPENSE";
                  const isTransfer = tx.type === "TRANSFER";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? "bg-surface-2"}`}>
                        {tx.categoryIcon ? <span className="text-base">{tx.categoryIcon}</span> : <Icon size={15} className={cfg?.color ?? "text-muted"} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description || tx.categoryName || cfg?.label}</p>
                        <p className="text-xs text-muted truncate">
                          {formatDate(tx.date)}{tx.accountName && ` · ${tx.accountName}`}{isTransfer && tx.toAccountName && ` → ${tx.toAccountName}`}
                        </p>
                      </div>
                      <p className={`text-sm font-bold font-mono ${isExpense ? "text-danger" : isTransfer ? "text-primary" : "text-success"}`}>
                        {isExpense ? "−" : isTransfer ? "" : "+"}{formatCurrency(tx.amount, tx.currency)}
                      </p>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10"><Pencil size={13} /></button>
                        <button onClick={() => setConfirmDeleteId(tx.id)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && filterType === "ALL" && filterAccountId === "ALL" && !searchQuery && (
                <div className="pt-4 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted">Mostrando {transactions.length} de {total} movimientos del mes</p>
                  <Button variant="outline" onClick={loadMore} disabled={isPending}>
                    {isPending ? "Cargando..." : "Cargar más"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setIsOpen(false); setLastDefaults({}); } }}>
        <DialogContent title="Nuevo movimiento">
          <TxForm key={formKey} onSubmit={handleCreate} type={txType} setType={setTxType}
            cats={filteredCategories} defaultValues={lastDefaults} submitLabel="Guardar" showAddAnother />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(o) => { if (!o) setEditingTx(null); }}>
        <DialogContent title="Editar movimiento">
          {editingTx && (
            <TxForm onSubmit={handleUpdate} type={editType} setType={setEditType}
              cats={filteredCategoriesEdit} defaultValues={editingTx} submitLabel="Actualizar" />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title="Eliminar movimiento"
        description="Esta acción no se puede deshacer. El saldo de la cuenta se ajustará automáticamente."
        confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        isPending={isPending}
      />

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts}
        categories={categories}
        onImported={async () => {
          const page = await getTransactionsAction(month, year);
          setTransactions(page.items);
          setTotal(page.total);
          setHasMore(page.hasMore);
        }}
      />
    </div>
  );
}
