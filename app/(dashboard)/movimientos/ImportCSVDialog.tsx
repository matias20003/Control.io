"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, Check, X, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { importTransactionsAction, type ImportRow } from "@/app/actions/import";
import { parseAmount, parseDate, detectColumns } from "@/lib/import-utils";
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

function autoDetect(headers: string[]): { date: string; description: string; amount: string; debit: string; credit: string } {
  const d = detectColumns(headers);
  return {
    date: d.date ?? "",
    description: d.description ?? "",
    amount: d.amount ?? "",
    debit: d.debit ?? "",
    credit: d.credit ?? "",
  };
}

// Recordamos el último mapeo (y modo) para no re-mapear cada vez que subís el
// resumen del mismo banco/MercadoPago.
const MAPPING_KEY = "csv_import_mapping";

export function ImportCSVDialog({ open, onOpenChange, accounts, categories, onImported }: Props) {
  const [step, setStep]           = useState<Step>("upload");
  const [headers, setHeaders]     = useState<string[]>([]);
  const [rawRows, setRawRows]     = useState<Record<string, string>[]>([]);
  const [mapping, setMapping]     = useState({ date: "", description: "", amount: "", debit: "", credit: "" });
  const [mode, setMode]           = useState<"single" | "split">("single"); // single amount col vs debit/credit cols
  const [defaultType, setDefaultType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [result, setResult]       = useState<{ imported: number; skipped: number; errors: number; total: number } | null>(null);
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
        let finalMapping = detected;

        // Mapeo recordado: si TODAS sus columnas no vacías están en este CSV, lo
        // usamos (mismo banco/MP de la última vez → no hace falta re-mapear).
        try {
          const saved = JSON.parse(localStorage.getItem(MAPPING_KEY) || "null");
          const cols = saved ? [saved.date, saved.description, saved.amount, saved.debit, saved.credit].filter(Boolean) : [];
          if (cols.length && cols.every((c: string) => hdrs.includes(c))) {
            finalMapping = { date: saved.date || "", description: saved.description || "", amount: saved.amount || "", debit: saved.debit || "", credit: saved.credit || "" };
            if (saved.mode === "split" || saved.mode === "single") setMode(saved.mode);
          } else if (detected.debit && detected.credit && detected.debit !== detected.credit) {
            setMode("split");
          }
        } catch {
          if (detected.debit && detected.credit && detected.debit !== detected.credit) setMode("split");
        }

        setHeaders(hdrs);
        setRawRows(res.data.slice(0, 500)); // cap at 500
        setMapping(finalMapping);
        setStep("map");
      },
      error: () => toast.error("Error al leer el archivo CSV"),
    });
  }

  function buildRows(): ImportRow[] {
    // ¿La columna de monto trae signos? (muchos exports usan negativo = gasto).
    const columnHasNegatives =
      mode === "single" && mapping.amount
        ? rawRows.some((row) => (parseAmount(row[mapping.amount]) ?? 0) < 0)
        : false;

    return rawRows
      .map((row) => {
        const isoDate = parseDate(row[mapping.date] ?? "");
        const description = (row[mapping.description] ?? "").trim();
        let amount = 0;
        let type: "INCOME" | "EXPENSE" = defaultType;

        if (mode === "split") {
          const debit = Math.abs(parseAmount(row[mapping.debit]) ?? 0);
          const credit = Math.abs(parseAmount(row[mapping.credit]) ?? 0);
          if (credit > 0) { amount = credit; type = "INCOME"; }
          else            { amount = debit;  type = "EXPENSE"; }
        } else {
          const signed = parseAmount(row[mapping.amount]);
          amount = Math.abs(signed ?? 0);
          // Si la columna trae signos, clasificamos por signo; si no, tipo por defecto.
          if (columnHasNegatives) type = (signed ?? 0) < 0 ? "EXPENSE" : "INCOME";
        }

        return {
          date: isoDate ?? "",
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
        setResult({ imported: res.imported, skipped: res.skipped, errors: res.errors, total: res.total });
        setStep("done");
        onImported();
      }
    });
  }

  const preview = buildRows().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent title="Importar CSV" className="w-full">
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
              <p>• Exportá desde MercadoPago o tu banco como CSV (o Excel → Guardar como CSV)</p>
              <p>• 🔁 Re-subí el resumen completo cuando quieras: <span className="text-foreground">solo se agregan los movimientos nuevos</span>, no se duplican</p>
              <p>• Los montos negativos se detectan como gastos automáticamente</p>
              <p>• La próxima vez recordamos tu mapeo de columnas</p>
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
                onClick={() => {
                  try { localStorage.setItem(MAPPING_KEY, JSON.stringify({ ...mapping, mode })); } catch {}
                  setStep("preview");
                }}
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
              <p className="text-primary">Se importan hasta {buildRows().length} movimientos. Los que ya estén cargados se omiten automáticamente (no se duplican).</p>
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
                {result.imported} movimiento{result.imported === 1 ? "" : "s"} nuevo{result.imported === 1 ? "" : "s"} importado{result.imported === 1 ? "" : "s"}
                {result.skipped > 0 && ` · ${result.skipped} ya estaban (no se duplicaron)`}
                {result.errors > 0 && ` · ${result.errors} con errores`}
              </p>
              {result.imported === 0 && result.skipped > 0 && (
                <p className="text-xs text-muted mt-2">Todos los movimientos del archivo ya estaban cargados. 👍</p>
              )}
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
