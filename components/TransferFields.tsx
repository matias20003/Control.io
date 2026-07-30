"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { calculateTransferConversion } from "@/lib/transfer-conversion";
import type { SerializedAccount } from "@/lib/db/accounts";

type RateReference = {
  currency: string;
  name: string;
  buy: number;
  sell: number;
  updatedAt: string;
  checkedAt: string;
  source: string;
};

type Props = {
  accounts: SerializedAccount[];
  idPrefix: string;
  defaultFromId?: string | null;
  defaultToId?: string | null;
  defaultAmount?: number | null;
  defaultExchangeRate?: number | null;
};

export function TransferFields({
  accounts,
  idPrefix,
  defaultFromId,
  defaultToId,
  defaultAmount,
  defaultExchangeRate,
}: Props) {
  const [fromId, setFromId] = useState(defaultFromId ?? "");
  const [toId, setToId] = useState(defaultToId ?? "");
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [rate, setRate] = useState(defaultExchangeRate && defaultExchangeRate !== 1 ? String(defaultExchangeRate) : "");
  const [rateTouched, setRateTouched] = useState(!!defaultExchangeRate && defaultExchangeRate !== 1);
  const [reference, setReference] = useState<RateReference | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
  const previousForeignCurrency = useRef<string | null>(null);
  const referenceRequest = useRef(0);

  const from = accounts.find((account) => account.id === fromId);
  const to = accounts.find((account) => account.id === toId);
  const isConversion = !!from && !!to && from.currency !== to.currency;
  const foreignCurrency = isConversion
    ? from?.currency === "ARS"
      ? to?.currency
      : to?.currency === "ARS"
        ? from?.currency
        : null
    : null;
  const suggestedSide = from?.currency === "ARS" ? "sell" : "buy";
  const suggestedRate = reference
    ? suggestedSide === "sell" ? reference.sell : reference.buy
    : null;

  useEffect(() => {
    if (!foreignCurrency) {
      setReference(null);
      previousForeignCurrency.current = null;
      return;
    }
    if (previousForeignCurrency.current && previousForeignCurrency.current !== foreignCurrency) {
      setRate("");
      setRateTouched(false);
    }
    previousForeignCurrency.current = foreignCurrency;
    let controller: AbortController | null = null;

    const refreshReference = () => {
      controller?.abort();
      controller = new AbortController();
      const requestId = ++referenceRequest.current;
      setLoadingReference(true);
      fetch(
        `/api/cotizaciones/referencia?currency=${encodeURIComponent(foreignCurrency)}&t=${Date.now()}`,
        {
          signal: controller.signal,
          cache: "no-store",
        }
      )
        .then((response) => response.json())
        .then((payload) => {
          if (requestId === referenceRequest.current) {
            setReference(payload.ok ? payload.data : null);
          }
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (requestId === referenceRequest.current) setReference(null);
        })
        .finally(() => {
          if (requestId === referenceRequest.current) setLoadingReference(false);
        });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshReference();
    };

    refreshReference();
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [foreignCurrency, referenceRefreshKey]);

  useEffect(() => {
    if (suggestedRate && !rateTouched) setRate(String(suggestedRate));
  }, [rateTouched, suggestedRate]);

  const result = useMemo(() => {
    if (!from || !to || !amount) return null;
    try {
      return calculateTransferConversion(Number(amount), from.currency, to.currency, rate ? Number(rate) : null);
    } catch {
      return null;
    }
  }, [amount, from, rate, to]);

  const unsupported = isConversion && !foreignCurrency;
  const amountStep = from?.currency === "BTC" ? "0.00000001" : "0.01";
  const formatRate = (value: number) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);
  const updateLabel = reference
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        .format(new Date(reference.updatedAt))
    : null;
  const checkedLabel = reference
    ? new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .format(new Date(reference.checkedAt))
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-from`}>Desde *</Label>
          <Select id={`${idPrefix}-from`} name="accountId" value={fromId}
            onChange={(event) => setFromId(event.target.value)} required>
            <option value="">Seleccionar cuenta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency}) · {formatCurrency(account.balance, account.currency)}
              </option>
            ))}
          </Select>
        </div>
        <ArrowLeftRight size={16} className="hidden sm:block mb-3 text-muted" />
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-to`}>Hacia *</Label>
          <Select id={`${idPrefix}-to`} name="toAccountId" value={toId}
            onChange={(event) => setToId(event.target.value)} required>
            <option value="">Seleccionar cuenta</option>
            {accounts.filter((account) => account.id !== fromId).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-amount`}>Entregás {from ? `(${from.currency})` : ""} *</Label>
        <Input id={`${idPrefix}-amount`} name="amount" type="number" step={amountStep} min={amountStep}
          value={amount} onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00" required autoFocus />
      </div>

      <input type="hidden" name="currency" value={from?.currency ?? ""} />

      {isConversion && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
          {foreignCurrency && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Cotización de referencia · {reference?.name ?? foreignCurrency}
                  </p>
                  <p className="text-[11px] text-muted">
                    {loadingReference
                      ? "Consultando DolarAPI…"
                      : reference
                        ? `${reference.source} · cotización ${updateLabel} · verificada ${checkedLabel}`
                        : "Referencia no disponible; podés ingresar tu cotización manual"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceRefreshKey((current) => current + 1)}
                  disabled={loadingReference}
                  aria-label="Actualizar cotización ahora"
                  title="Actualizar cotización ahora"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-primary hover:bg-primary/10 disabled:cursor-wait"
                >
                  <RefreshCw
                    size={14}
                    className={loadingReference ? "animate-spin" : ""}
                  />
                </button>
              </div>
              {reference && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setRate(String(reference.buy)); setRateTouched(true); }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      suggestedSide === "buy" ? "border-success/40 bg-success/10" : "border-border bg-surface/70"
                    }`}>
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
                      <ArrowDownLeft size={11} className="text-success" /> Compra
                    </span>
                    <strong className="mt-0.5 block text-sm font-mono text-foreground">{formatRate(reference.buy)}</strong>
                  </button>
                  <button type="button" onClick={() => { setRate(String(reference.sell)); setRateTouched(true); }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      suggestedSide === "sell" ? "border-primary/40 bg-primary/10" : "border-border bg-surface/70"
                    }`}>
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
                      <ArrowUpRight size={11} className="text-danger" /> Venta
                    </span>
                    <strong className="mt-0.5 block text-sm font-mono text-foreground">{formatRate(reference.sell)}</strong>
                  </button>
                </div>
              )}
              {reference && (
                <p className="text-[11px] text-muted">
                  Sugerida para esta operación: <span className="font-semibold text-foreground">
                    {suggestedSide === "buy" ? "compra" : "venta"}
                  </span>. Tocá cualquiera de las dos para usarla.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-rate`}>
              Cotización (ARS por 1 {foreignCurrency ?? "unidad"}) *
            </Label>
            <Input id={`${idPrefix}-rate`} name="exchangeRate" type="number" step="0.0001" min="0.0001"
              value={rate} onChange={(event) => { setRate(event.target.value); setRateTouched(true); }}
              placeholder="Ingresá la cotización real" required={!unsupported} disabled={unsupported} />
          </div>
          {unsupported ? (
            <p className="text-xs text-danger">Por ahora una de las dos cuentas debe estar en pesos argentinos.</p>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-primary/15 pt-3">
              <span className="text-xs text-muted">Recibís en {to?.name}</span>
              <strong className="font-mono text-lg text-primary">
                {result ? formatCurrency(result.destinationAmount, result.destinationCurrency) : "—"}
              </strong>
            </div>
          )}
        </div>
      )}

      {!isConversion && from && to && (
        <p className="text-xs text-muted">
          Se acreditará el mismo importe en {to.name} porque ambas cuentas están en {from.currency}.
        </p>
      )}
    </div>
  );
}
