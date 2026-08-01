export function recurringAccountStatus(
  type: "INCOME" | "EXPENSE" | string,
  accountName: string | null,
  executed = false,
): string {
  if (type === "INCOME") {
    if (!accountName) return "falta asignar la cuenta de destino";
    return `${executed ? "recibido" : "se recibe"} en ${accountName}`;
  }

  if (!accountName) return "requiere pago · asigná una cuenta";
  return `${executed ? "descontado" : "se descuenta"} de ${accountName}`;
}
