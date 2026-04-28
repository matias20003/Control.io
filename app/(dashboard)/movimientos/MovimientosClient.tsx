"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
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
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  initialMonth: number;
  initialYear: number;
}

export function MovimientosClient({ initialTransactions, accounts, categories, initialMonth, initialYear }: Props) {
  const now = new Date();
  const [month, setMonth]             = useState(initialMonth);
  const [year, setYear]               = useState(initialYear);
  const [transactions, setTransactions] = useState<SerializedTransaction[]>(initialTransactions);
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

  const [isPending, startTransition]  = useTransition();

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
      const data = await getTransactionsAction(newMonth, newYear);
      setTransactions(data);
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

  // Handlers
  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createTransactionAction(formData);
      if (result.error) { toast.error(result.error); return; }
      if (result.success && result.transaction) {
        const tx = result.transaction;
        const txDate = new Date(tx.date);
        if (txDate.getMonth() + 1 === month && txDate.getFullYear() === year) {
          setTransactions((prev) => [tx, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        setIsOpen(false);
        toast.success(`${TYPE_CONFIG[tx.type as TxType]?.label ?? "Movimiento"} registrado ✓`);
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
    onSubmit, type, setType, cats, defaultValues, submitLabel,
  }: {
    onSubmit: (fd: FormData) => void;
    type: TxType;
    setType: (t: TxType) => void;
    cats: typeof filteredCategories;
    defaultValues?: Partial<SerializedTransaction>;
    submitLabel: string;
  }) => (
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-amount">Monto *</Label>
            <Input id="f-amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00"
              defaultValue={defaultValues?.amount ?? ""} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-currency">Moneda</Label>
            <Select id="f-currency" name="currency" defaultValue={defaultValues?.currency ?? "ARS"}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-date">Fecha *</Label>
          <Input id="f-date" name="date" type="date"
            defaultValue={defaultValues?.date ? defaultValues.date.split("T")[0] : new Date().toISOString().split("T")[0]}
            required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-description">Descripción</Label>
          <Input id="f-description" name="description" placeholder="Ej: Almuerzo con clientes"
            defaultValue={defaultValues?.description ?? ""} />
        </div>
        {type !== "TRANSFER" && (
          <div className="space-y-1.5">
            <Label htmlFor="f-category">Categoría</Label>
            <Select id="f-category" name="categoryId" defaultValue={defaultValues?.categoryId ?? ""}>
              <option value="">Sin categoría</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </div>
        )}
        {type !== "TRANSFER" ? (
          <div className="space-y-1.5">
            <Label htmlFor="f-account">Cuenta</Label>
            <Select id="f-account" name="accountId" defaultValue={defaultValues?.accountId ?? ""}>
              <option value="">Sin cuenta</option>
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
        <div className="space-y-1.5">
          <Label htmlFor="f-notes">Notas</Label>
          <Textarea id="f-notes" name="notes" placeholder="Notas adicionales..." rows={2}
            defaultValue={defaultValues?.notes ?? ""} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1"
            onClick={() => { setIsOpen(false); setEditingTx(null); }}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Guardando..." : submitLabel}
          </Button>
        </div>
      </form>
    </>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Movimientos</h1>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="success" onClick={() => openCreate("INCOME")} className="w-full">
            <ArrowDownLeft size={16} className="mr-1.5" />Nuevo ingreso
          </Button>
          <Button variant="danger" onClick={() => openCreate("EXPENSE")} className="w-full">
            <ArrowUpRight size={16} className="mr-1.5" />Nuevo gasto
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => openCreate("TRANSFER")}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors">
            <ArrowLeftRight size={12} />Nueva transferencia
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors"
          >
            <Upload size={12} />Importar CSV
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} disabled={isPending}
          className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-foreground capitalize">
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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-success/10 rounded-xl p-3">
          <p className="text-xs text-muted mb-0.5">Ingresos</p>
          <p className="text-base font-bold font-mono text-success">{formatCurrency(totalIncome, "ARS")}</p>
        </div>
        <div className="bg-danger/10 rounded-xl p-3">
          <p className="text-xs text-muted mb-0.5">Gastos</p>
          <p className="text-base font-bold font-mono text-danger">{formatCurrency(totalExpense, "ARS")}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por descripción, categoría, cuenta..."
          className="w-full pl-8 pr-8 py-2 text-sm rounded-xl border border-border bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin movimientos"
          description={searchQuery ? `No hay resultados para "${searchQuery}".`
            : filterType === "ALL" && filterAccountId === "ALL"
            ? "Registrá ingresos, gastos o transferencias para este mes."
            : "No hay movimientos con los filtros seleccionados."}
          action={!searchQuery && filterType === "ALL" && filterAccountId === "ALL" ? (
            <div className="flex gap-2">
              <Button variant="success" onClick={() => openCreate("INCOME")}><ArrowDownLeft size={16} className="mr-1.5" />Ingreso</Button>
              <Button variant="danger"  onClick={() => openCreate("EXPENSE")}><ArrowUpRight  size={16} className="mr-1.5" />Gasto</Button>
            </div>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const cfg      = TYPE_CONFIG[tx.type as TxType];
            const Icon     = cfg?.icon ?? Receipt;
            const isExpense  = tx.type === "EXPENSE";
            const isTransfer = tx.type === "TRANSFER";
            return (
              <Card key={tx.id} className="group">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? "bg-surface-2"}`}>
                      {tx.categoryIcon
                        ? <span className="text-base">{tx.categoryIcon}</span>
                        : <Icon size={15} className={cfg?.color ?? "text-muted"} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tx.description || tx.categoryName || cfg?.label}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {formatDate(tx.date)}
                        {tx.accountName && ` · ${tx.accountName}`}
                        {isTransfer && tx.toAccountName && ` → ${tx.toAccountName}`}
                        {tx.description && tx.categoryName ? ` · ${tx.categoryName}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold font-mono ${isExpense ? "text-danger" : isTransfer ? "text-primary" : "text-success"}`}>
                        {isExpense ? "−" : isTransfer ? "" : "+"}
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(tx)}
                        className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(tx.id)}
                        className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nuevo movimiento">
          <TxForm onSubmit={handleCreate} type={txType} setType={setTxType}
            cats={filteredCategories} submitLabel="Guardar" />
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
          const data = await getTransactionsAction(month, year);
          setTransactions(data);
        }}
      />
    </div>
  );
}
