"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, Check, X, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { importTransactionsAction, type ImportRow } from "@/app/actions/import";
import type { SerializedAccount } from "@/lib/db/accounts";
import type { SerializedCategory } from "@/lib/db/categories";

type Step = "upload" | "map" | "preview" | "done";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: SerializedAccount[];
  categories: SerializedCategory[];
  onImported: () => void;
}

// Common column name patterns for auto-detection
const DATE_PATTERNS    = ["fecha", "date", "fec", "dia", "día"];
const DESC_PATTERNS    = ["descripcion", "descripción", "description", "concepto", "detalle", "motivo", "glosa"];
const AMOUNT_PATTERNS  = ["importe", "monto", "amount", "valor", "total", "credito", "crédito", "debito", "débito"];
const DEBIT_PATTERNS   = ["debito", "débito", "debit", "egreso", "gasto"];
const CREDIT_PATTERNS  = ["credito", "crédito", "credit", "ingreso", "haber"];

function autoDetect(headers: string[]): { date: string; description: string; amount: string; debit: string; credit: string } {
  const norm = (h: string) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const find = (patterns: string[]) =>
    headers.find((h) => patterns.some((p) => norm(h).includes(p))) ?? "";

  return {
    date:        find(DATE_PATTERNS),
    description: find(DESC_PATTERNS),
    amount:      find(AMOUNT_PATTERNS),
    debit:       find(DEBIT_PATTERNS),
    credit:      find(CREDIT_PATTERNS),
  };
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  // Remove currency symbols, spaces, dots as thousand separators, convert comma decimal
  const clean = raw.replace(/[$ ]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.abs(parseFloat(clean) || 0);
}

export function ImportCSVDialog({ open, onOpenChange, accounts, categories, onImported }: Props) {
  const [step, setStep]           = useState<Step>("upload");
  const [headers, setHeaders]     = useState<string[]>([]);
  const [rawRows, setRawRows]     = useState<Record<string, string>[]>([]);
  const [mapping, setMapping]     = useState({ date: "", description: "", amount: "", debit: "", credit: "" });
  const [mode, setMode]           = useState<"single" | "split">("single"); // single amount col vs debit/credit cols
  const [defaultType, setDefaultType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [result, setResult]       = useState<{ imported: number; errors: number; total: number } | null>(null);
  const [isPending, start]        = useTransition();

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({ date: "", description: "", amount: "", debit: "", credit: "" });
    setMode("single");
    setResult(null);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hdrs = res.meta.fields ?? [];
        const detected = autoDetect(hdrs);
        setHeaders(hdrs);
        setRawRows(res.data.slice(0, 500)); // cap at 500
        setMapping(detected);
        // Auto-detect mode
        if (detected.debit && detected.credit && detected.debit !== detected.credit) {
          setMode("split");
        }
        setStep("map");
      },
      error: () => toast.error("Error al leer el archivo CSV"),
    });
  }

  function buildRows(): ImportRow[] {
    return rawRows
      .map((row) => {
        const date        = row[mapping.date] ?? "";
        const description = (row[mapping.description] ?? "").trim();
        let amount = 0;
        let type: "INCOME" | "EXPENSE" = defaultType;

        if (mode === "split") {
          const debit  = parseAmount(row[mapping.debit]  ?? "");
          const credit = parseAmount(row[mapping.credit] ?? "");
          if (credit > 0) { amount = credit; type = "INCOME"; }
          else            { amount = debit;  type = "EXPENSE"; }
        } else {
          const raw = row[mapping.amount] ?? "";
          amount = parseAmount(raw);
          // Try to detect sign
          const rawClean = raw.replace(/[$ .]/g, "").replace(",", ".");
          if (rawClean.startsWith("-")) type = "EXPENSE";
        }

        return {
          date: date.trim(),
          description: description || "Sin descripción",
          amount,
          type,
          categoryId: categoryId || undefined,
          accountId: accountId || undefined,
        } satisfies ImportRow;
      })
      .filter((r) => r.amount > 0 && r.date);
  }

  function handleImport() {
    const rows = buildRows();
    if (!rows.length) { toast.error("No hay filas válidas para importar"); return; }

    start(async () => {
      const res = await importTransactionsAction(rows);
      if ("error" in res && res.error) { toast.error(res.error); return; }
      if (res.ok) {
        setResult({ imported: res.imported, errors: res.errors, total: res.total });
        setStep("done");
        onImported();
      }
    });
  }

  const preview = buildRows().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent title="Importar CSV" className="max-w-lg w-full">
        {/* ── STEP: upload ── */}
        {step === "upload" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Importar desde CSV</h2>
              <p className="text-sm text-muted mt-0.5">Compatible con cualquier banco o exportación de Excel/Sheets</p>
            </div>

            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-border hover:border-primary rounded-xl p-8 text-center transition-colors">
                <Upload size={32} className="text-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Subí tu archivo CSV</p>
                <p className="text-xs text-muted mt-1">Máximo 500 filas</p>
              </div>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>

            <div className="bg-surface-2 rounded-xl p-3 text-xs text-muted space-y-1">
              <p className="font-medium text-foreground">Consejos:</p>
              <p>• Exportá desde tu banco como CSV o Excel → Guardar como CSV</p>
              <p>• Los montos negativos se detectan como gastos automáticamente</p>
              <p>• Podés mapear columnas en el siguiente paso</p>
            </div>
          </div>
        )}

        {/* ── STEP: map ── */}
        {step === "map" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Mapear columnas</h2>
              <p className="text-sm text-muted">{rawRows.length} filas detectadas</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted mb-1">Columna de fecha *</p>
                <Select value={mapping.date} onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Columna de descripción</p>
                <Select value={mapping.description} onChange={(e) => setMapping((m) => ({ ...m, description: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Formato de montos</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={mode === "single"} onChange={() => setMode("single")} />
                  Una columna de monto
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={mode === "split"} onChange={() => setMode("split")} />
                  Débito / Crédito separados
                </label>
              </div>
            </div>

            {mode === "single" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted mb-1">Columna de monto *</p>
                  <Select value={mapping.amount} onChange={(e) => setMapping((m) => ({ ...m, amount: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Tipo por defecto</p>
                  <Select value={defaultType} onChange={(e) => setDefaultType(e.target.value as any)}>
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted mb-1">Columna débito (gastos)</p>
                  <Select value={mapping.debit} onChange={(e) => setMapping((m) => ({ ...m, debit: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Columna crédito (ingresos)</p>
                  <Select value={mapping.credit} onChange={(e) => setMapping((m) => ({ ...m, credit: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted mb-1">Cuenta (opcional)</p>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Sin cuenta</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Categoría (opcional)</p>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.filter(c => c.type === "EXPENSE").map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("upload")}>Atrás</Button>
              <Button
                className="flex-1"
                onClick={() => setStep("preview")}
                disabled={!mapping.date || (mode === "single" ? !mapping.amount : !mapping.debit && !mapping.credit)}
              >
                Vista previa <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Vista previa</h2>
              <p className="text-sm text-muted">{buildRows().length} filas válidas de {rawRows.length}</p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {preview.map((row, i) => (
                <div key={i} className="bg-surface-2 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.description}</p>
                    <p className="text-xs text-muted">{row.date}</p>
                  </div>
                  <p className={`text-sm font-bold font-mono shrink-0 ${row.type === "INCOME" ? "text-success" : "text-danger"}`}>
                    {row.type === "INCOME" ? "+" : "-"}
                    {new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(row.amount)}
                  </p>
                </div>
              ))}
              {buildRows().length > 5 && (
                <p className="text-xs text-muted text-center">... y {buildRows().length - 5} más</p>
              )}
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex gap-2 text-sm">
              <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-primary">Se van a crear {buildRows().length} movimientos. Esta acción no se puede deshacer fácilmente.</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("map")}>Atrás</Button>
              <Button className="flex-1" onClick={handleImport} disabled={isPending}>
                {isPending ? "Importando..." : `Importar ${buildRows().length} filas`}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === "done" && result && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <Check size={32} className="text-success" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">¡Importación exitosa!</h2>
              <p className="text-sm text-muted mt-1">
                {result.imported} movimientos importados correctamente
                {result.errors > 0 && ` · ${result.errors} con errores`}
              </p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
