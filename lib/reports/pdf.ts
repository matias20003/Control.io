import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { PeriodicReportSnapshot } from "./periodic";

const C = {
  ink: rgb(15 / 255, 23 / 255, 42 / 255),
  muted: rgb(100 / 255, 116 / 255, 139 / 255),
  border: rgb(226 / 255, 232 / 255, 240 / 255),
  surface: rgb(248 / 255, 250 / 255, 252 / 255),
  primary: rgb(14 / 255, 165 / 255, 233 / 255),
  green: rgb(34 / 255, 197 / 255, 94 / 255),
  red: rgb(239 / 255, 68 / 255, 68 / 255),
  amber: rgb(245 / 255, 158 / 255, 11 / 255),
  white: rgb(1, 1, 1),
};
const W = 595.28;
const H = 841.89;
const M = 42;
const money = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
const clean = (s: string) => s.replace(/[^\u0020-\u00FF]/g, "").replace(/\s+/g, " ").trim();

function text(page: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont, color = C.ink) {
  page.drawText(clean(value), { x, y, size, font, color });
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const words = clean(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function header(page: PDFPage, regular: PDFFont, bold: PDFFont, snapshot: PeriodicReportSnapshot, pageNo: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.white });
  text(page, "control.io", M, H - 48, 19, bold, C.primary);
  text(page, "REPORTE Y TENDENCIAS", M + 103, H - 44, 8, bold, C.muted);
  page.drawLine({ start: { x: M, y: H - 62 }, end: { x: W - M, y: H - 62 }, thickness: 1, color: C.border });
  text(page, `Página ${pageNo}`, W - M - 42, 26, 8, regular, C.muted);
  text(page, `${shortDate(snapshot.periodStart)} - ${shortDate(snapshot.periodEnd)}`, M, 26, 8, regular, C.muted);
}

function metric(page: PDFPage, x: number, y: number, width: number, label: string, value: string, color: ReturnType<typeof rgb>, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y, width, height: 68, color: C.surface, borderColor: C.border, borderWidth: 1 });
  text(page, label.toUpperCase(), x + 12, y + 46, 7.5, bold, C.muted);
  text(page, value, x + 12, y + 20, 15, bold, color);
}

export async function renderPeriodicReportPdf(snapshot: PeriodicReportSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`Reporte y tendencias - control.io`);
  pdf.setAuthor("control.io");

  const page = pdf.addPage([W, H]);
  header(page, regular, bold, snapshot, 1);
  text(page, `Hola, ${snapshot.name}`, M, H - 105, 11, regular, C.muted);
  text(page, `Tu panorama ${snapshot.frequency === "WEEKLY" ? "semanal" : snapshot.frequency === "FORTNIGHTLY" ? "quincenal" : "mensual"}`, M, H - 135, 25, bold);
  text(page, `${shortDate(snapshot.periodStart)} al ${shortDate(snapshot.periodEnd)}`, M, H - 155, 10, regular, C.muted);

  const gap = 10;
  const metricW = (W - M * 2 - gap * 2) / 3;
  metric(page, M, H - 245, metricW, "Ingresos", money(snapshot.income), C.green, regular, bold);
  metric(page, M + metricW + gap, H - 245, metricW, "Gastos", money(snapshot.expense), C.red, regular, bold);
  metric(page, M + (metricW + gap) * 2, H - 245, metricW, "Balance", money(snapshot.balance), snapshot.balance >= 0 ? C.green : C.red, regular, bold);

  text(page, "EVOLUCIÓN DEL PERÍODO", M, H - 285, 9, bold, C.muted);
  const chartX = M;
  const chartY = H - 455;
  const chartW = W - M * 2;
  const chartH = 135;
  page.drawRectangle({ x: chartX, y: chartY, width: chartW, height: chartH, color: C.surface, borderColor: C.border, borderWidth: 1 });
  const daily = snapshot.days;
  const max = Math.max(1, ...daily.map((d) => Math.max(d.expense, d.income)));
  const bw = daily.length ? Math.min(16, (chartW - 40) / daily.length - 2) : 8;
  daily.forEach((d, index) => {
    const x = chartX + 22 + index * ((chartW - 44) / Math.max(1, daily.length));
    const eh = (d.expense / max) * 90;
    const ih = (d.income / max) * 90;
    page.drawRectangle({ x, y: chartY + 24, width: bw, height: eh, color: C.red, opacity: 0.78 });
    page.drawRectangle({ x: x + bw * 0.48, y: chartY + 24, width: bw * 0.52, height: ih, color: C.green, opacity: 0.8 });
  });
  text(page, "Gastos", chartX + 18, chartY + 9, 7, regular, C.red);
  text(page, "Ingresos", chartX + 65, chartY + 9, 7, regular, C.green);

  text(page, "LECTURA RÁPIDA", M, H - 495, 9, bold, C.muted);
  let iy = H - 525;
  snapshot.insights.slice(0, 4).forEach((insight) => {
    page.drawCircle({ x: M + 5, y: iy + 3, size: 3, color: C.primary });
    const lines = wrap(insight, regular, 10, W - M * 2 - 24);
    lines.forEach((line, index) => text(page, line, M + 18, iy - index * 14, 10, regular));
    iy -= lines.length * 14 + 12;
  });

  metric(page, M, 93, metricW, "Tasa de ahorro", `${snapshot.savingsRate}%`, snapshot.savingsRate >= 20 ? C.green : C.amber, regular, bold);
  metric(page, M + metricW + gap, 93, metricW, "Movimientos", String(snapshot.transactionCount), C.primary, regular, bold);
  metric(page, M + (metricW + gap) * 2, 93, metricW, "Gasto diario", money(snapshot.avgDailyExpense), C.ink, regular, bold);

  const page2 = pdf.addPage([W, H]);
  header(page2, regular, bold, snapshot, 2);
  text(page2, "¿En qué se fue tu dinero?", M, H - 110, 23, bold);
  text(page2, "Distribución por categorías", M, H - 130, 10, regular, C.muted);
  let cy = H - 178;
  snapshot.categories.slice(0, 10).forEach((category, index) => {
    const barW = (W - M * 2 - 150) * (category.percentage / 100);
    text(page2, `${index + 1}. ${category.name}`, M, cy + 7, 9.5, index < 3 ? bold : regular);
    page2.drawRectangle({ x: M + 150, y: cy, width: W - M * 2 - 150, height: 16, color: C.surface });
    page2.drawRectangle({ x: M + 150, y: cy, width: Math.max(2, barW), height: 16, color: index === 0 ? C.primary : rgb(56 / 255, 189 / 255, 248 / 255), opacity: 1 - index * 0.055 });
    text(page2, `${category.percentage}%`, W - M - 34, cy + 5, 8, bold, C.ink);
    text(page2, money(category.total), M + 150, cy - 13, 8, regular, C.muted);
    cy -= 48;
  });

  const page3 = pdf.addPage([W, H]);
  header(page3, regular, bold, snapshot, 3);
  text(page3, "Principales movimientos", M, H - 110, 23, bold);
  text(page3, "Los gastos de mayor impacto del período", M, H - 130, 10, regular, C.muted);
  let ty = H - 174;
  snapshot.topExpenses.forEach((tx, index) => {
    page3.drawRectangle({ x: M, y: ty - 33, width: W - M * 2, height: 48, color: index % 2 ? C.white : C.surface, borderColor: C.border, borderWidth: index % 2 ? 0 : 1 });
    text(page3, tx.description.slice(0, 48), M + 12, ty - 1, 10, bold);
    text(page3, `${tx.category} · ${shortDate(tx.date)}`, M + 12, ty - 18, 8, regular, C.muted);
    const amount = money(tx.amount);
    text(page3, amount, W - M - bold.widthOfTextAtSize(amount, 10) - 12, ty - 7, 10, bold, C.red);
    ty -= 59;
  });
  if (!snapshot.topExpenses.length) text(page3, "No se registraron gastos durante este período.", M, ty, 11, regular, C.muted);

  text(page3, "PRÓXIMO PASO RECOMENDADO", M, 165, 9, bold, C.muted);
  page3.drawRectangle({ x: M, y: 78, width: W - M * 2, height: 70, color: rgb(239 / 255, 248 / 255, 1), borderColor: rgb(186 / 255, 230 / 255, 253 / 255), borderWidth: 1 });
  const recommendation = snapshot.categories[0]
    ? `Revisá ${snapshot.categories[0].name}: es la categoría con mayor impacto. Definí un límite concreto para el próximo período y pedile al agente de WhatsApp que te avise cuando te acerques.`
    : "Registrá tus movimientos durante el próximo período para obtener comparaciones y recomendaciones más precisas.";
  wrap(recommendation, regular, 10, W - M * 2 - 28).forEach((line, index) =>
    text(page3, line, M + 14, 124 - index * 15, 10, regular),
  );

  return pdf.save();
}

