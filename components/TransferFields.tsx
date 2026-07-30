"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { calculateTransferConversion } from "@/lib/transfer-conversion";
import type { SerializedAccount } from "@/lib/db/accounts";

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

  const from = accounts.find((account) => account.id === fromId);
  const to = accounts.find((account) => account.id === toId);
  const isConversion = !!from && !!to && from.currency !== to.currency;

  const result = useMemo(() => {
    if (!from || !to || !amount) return null;
    try {
      return calculateTransferConversion(Number(amount), from.currency, to.currency, rate ? Number(rate) : null);
    } catch {
      return null;
    }
  }, [amount, from, rate, to]);

  const unsupported = isConversion
    && !([from?.currency, to?.currency].includes("ARS") && [from?.currency, to?.currency].includes("USD"));

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
        <Input id={`${idPrefix}-amount`} name="amount" type="number" step="0.01" min="0.01"
          value={amount} onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00" required autoFocus />
      </div>

      <input type="hidden" name="currency" value={from?.currency ?? ""} />

      {isConversion && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-rate`}>Cotización (ARS por 1 USD) *</Label>
            <Input id={`${idPrefix}-rate`} name="exchangeRate" type="number" step="0.0001" min="0.0001"
              value={rate} onChange={(event) => setRate(event.target.value)}
              placeholder="Ej: 1350" required={!unsupported} disabled={unsupported} />
          </div>
          {unsupported ? (
            <p className="text-xs text-danger">Por ahora las conversiones están disponibles entre cuentas ARS y USD.</p>
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
