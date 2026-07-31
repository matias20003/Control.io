import "server-only";
import { z } from "zod";
import { geminiChatJson, geminiEnabled, openaiChatJson } from "@/lib/ai/chat";

const Classification = z.object({
  kind: z.enum(["financial_receipt", "study_material", "other"]),
  readable: z.boolean().default(true),
  evidence: z.string().default(""),
});

export type ImageClassification = z.infer<typeof Classification>;

const SYSTEM = `Clasificá la imagen para enrutarla dentro de una app financiera.
Respondé solamente JSON:
{"kind":"financial_receipt"|"study_material"|"other","readable":boolean,"evidence":string}

financial_receipt incluye SIEMPRE: comprobantes de Mercado Pago/bancos/billeteras,
transferencias, pagos, cobros, tickets, facturas, recibos, resúmenes y capturas con
un importe o movimiento. El logo, "$", "comprobante", "transferencia", "de", "para",
CVU/CBU/CUIT u operación bancaria alcanzan aunque el texto sea pequeño.
study_material solo si es inequívocamente un apunte, índice, ejercicio o temario.
En evidence transcribí brevemente los datos financieros visibles: tipo, importe,
fecha, origen, destino, concepto y entidad. No inventes.`;

export async function classifyWhatsappImage(imageDataUrl: string): Promise<ImageClassification> {
  const input = { system: SYSTEM, history: [], userText: "Clasificá esta imagen.", imageDataUrl };
  let raw: string;
  try {
    raw = geminiEnabled() ? await geminiChatJson(input) : await openaiChatJson(input);
  } catch {
    raw = await openaiChatJson(input);
  }
  try {
    return Classification.parse(JSON.parse(raw));
  } catch {
    return { kind: "other", readable: false, evidence: "" };
  }
}

export function routingInstruction(classification: ImageClassification): string {
  if (classification.kind === "financial_receipt") {
    return `[CLASIFICACIÓN_VISUAL: COMPROBANTE_FINANCIERO]
Esta clasificación tiene prioridad absoluta sobre Estudio. Es un comprobante, ticket, factura o movimiento financiero.
Datos visibles: ${classification.evidence || "Leé directamente importe, fecha, origen y destino de la imagen."}
Creá la acción financiera correspondiente. En transferencias emitidas por el usuario, registrá un GASTO salvo que indique claramente que recibió el dinero.`;
  }
  if (classification.kind === "study_material") {
    return `[CLASIFICACIÓN_VISUAL: MATERIAL_DE_ESTUDIO]\n${classification.evidence}`;
  }
  return "";
}
