import { describe, expect, it } from "vitest";
import { recurringAccountStatus } from "@/lib/recurring-copy";

describe("recurringAccountStatus", () => {
  it("describes income as money received into the account", () => {
    expect(recurringAccountStatus("INCOME", "Mercado Pago")).toBe("se recibe en Mercado Pago");
    expect(recurringAccountStatus("INCOME", "Mercado Pago", true)).toBe("recibido en Mercado Pago");
  });

  it("describes expenses as money deducted from the account", () => {
    expect(recurringAccountStatus("EXPENSE", "Mercado Pago")).toBe("se descuenta de Mercado Pago");
    expect(recurringAccountStatus("EXPENSE", "Mercado Pago", true)).toBe("descontado de Mercado Pago");
  });

  it("uses direction-specific copy when no account is assigned", () => {
    expect(recurringAccountStatus("INCOME", null)).toBe("falta asignar la cuenta de destino");
    expect(recurringAccountStatus("EXPENSE", null)).toBe("requiere pago · asigná una cuenta");
  });
});
