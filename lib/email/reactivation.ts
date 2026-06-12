/**
 * Email de reactivación para usuarios que se registraron y todavía no cargaron
 * ningún movimiento. Objetivo: llevarlos a su primer "aha" (cargar un gasto y
 * ver el dashboard cobrar vida).
 */
export function buildReactivationHtml(opts: { name: string; appUrl: string; dormant?: boolean }): string {
  const { name, appUrl, dormant = false } = opts;

  const headline = dormant ? `${name}, ¿todo bien? 👋` : `${name}, ¿arrancamos? 👋`;
  const intro = dormant
    ? `Hace un tiempo que no pasás por control.io. Tus cuentas, movimientos y números te están esperando — entrá y ponete al día en un toque.`
    : `Te registraste en control.io pero todavía no cargaste tu primer movimiento. Toma <strong style="color:#f8fafc;">menos de 10 segundos</strong> y recién ahí la app cobra vida con tus números.`;
  const cta = dormant ? "Volver a control.io →" : "Cargar mi primer movimiento →";

  const examples = dormant
    ? ""
    : `<div style="background:#1e293b; border-radius:12px; padding:20px; margin-bottom:24px;">
      <p style="font-size:14px; color:#94a3b8; margin:0 0 12px; font-weight:600;">Probá cargar algo así:</p>
      <p style="font-size:15px; color:#f8fafc; margin:0 0 6px;">🔴 Gasté $5.000 en el súper</p>
      <p style="font-size:15px; color:#f8fafc; margin:0;">🟢 Cobré mi sueldo</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#f8fafc;">
  <div style="max-width:560px; margin:0 auto; padding:32px 24px;">
    <div style="text-align:center; margin-bottom:28px;">
      <span style="display:inline-block; width:56px; height:56px; line-height:56px; border-radius:14px; background:#2563EB; color:#fff; font-size:30px; font-weight:700;">c</span>
    </div>

    <h1 style="font-size:22px; font-weight:800; margin:0 0 12px; text-align:center;">
      ${headline}
    </h1>
    <p style="font-size:15px; line-height:1.6; color:#cbd5e1; text-align:center; margin:0 0 24px;">
      ${intro}
    </p>

    ${examples}

    <div style="text-align:center; margin-bottom:28px;">
      <a href="${appUrl}/dashboard"
         style="display:inline-block; background:#2563EB; color:#ffffff; text-decoration:none; font-weight:700; font-size:15px; padding:14px 36px; border-radius:10px;">
        ${cta}
      </a>
    </div>

    <div style="background:#1d4ed820; border:1px solid #3b82f6; border-radius:10px; padding:14px 16px; margin-bottom:28px;">
      <p style="font-size:14px; color:#dbeafe; margin:0; text-align:center;">
        💬 <strong>Tip:</strong> también podés cargar gastos por WhatsApp — mandás un texto,
        un audio o la foto de un ticket y se registra solo. Vinculá tu número en
        <span style="color:#fff;">Configuración → Perfil</span>.
      </p>
    </div>

    <p style="font-size:12px; color:#64748b; text-align:center; margin:0;">
      Si no querés estos recordatorios, ignorá este mail — no te escribimos de nuevo.
    </p>
  </div>
</body>
</html>`;
}
