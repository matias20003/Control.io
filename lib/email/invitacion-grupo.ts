interface InvitacionGrupoParams {
  grupoNombre: string;
  invitadoPorNombre: string;
  nombreInvitado?: string;
  link: string;
}

export function invitacionGrupoHtml({
  grupoNombre,
  invitadoPorNombre,
  nombreInvitado,
  link,
}: InvitacionGrupoParams): string {
  const saludo = nombreInvitado ? `Hola ${nombreInvitado},` : "Hola,";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a grupo</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #334155;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">
                  control<span style="color:#38bdf8;">.io</span>
                </span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;">${saludo}</p>
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.3;">
                Te invitaron al grupo<br/>
                <span style="color:#38bdf8;">"${grupoNombre}"</span>
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#f1f5f9;">${invitadoPorNombre}</strong> te invitó a unirte a un grupo de gastos compartidos en control.io.
                Podrás ver los gastos del grupo, cargar los tuyos y ver al instante cuánto le debe cada uno a quién.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${link}" style="display:inline-block;padding:14px 32px;background:#38bdf8;color:#0f172a;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
                      Unirme al grupo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#64748b;text-align:center;">
                Este link expira en 7 días. Si no esperabas esta invitación, podés ignorar este email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                control.io · Finanzas personales ·
                <a href="${link}" style="color:#38bdf8;text-decoration:none;">Ver invitación</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
