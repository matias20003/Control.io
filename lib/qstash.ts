// Programa el disparo EXACTO de un recordatorio vía Upstash QStash.
// Al crear el recordatorio le decimos a QStash "llamá a este endpoint dentro de
// N segundos" → nos pega justo a la hora, sin polling. Si QSTASH_TOKEN no está
// configurado, no hace nada (queda el cron de respaldo /api/cron/reminders).

const QSTASH_PUBLISH = "https://qstash.upstash.io/v2/publish";

function siteBase(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  return url && url.startsWith("https://") ? url.replace(/\/+$/, "") : "https://controlio.site";
}

export async function scheduleReminderDelivery(reminderId: string, when: Date): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const secret = process.env.CRON_SECRET;
  if (!token || !secret) return; // sin QStash → lo dispara el cron de respaldo

  const callback = `${siteBase()}/api/qstash/reminder`;
  const delaySec = Math.max(0, Math.round((when.getTime() - Date.now()) / 1000));

  try {
    const res = await fetch(`${QSTASH_PUBLISH}/${callback}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // QStash espera estos segundos y recién ahí pega al callback.
        "Upstash-Delay": `${delaySec}s`,
        // Reenvía este header al callback para autenticarlo (reusa CRON_SECRET).
        "Upstash-Forward-Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({ reminderId }),
    });
    if (!res.ok) {
      console.error("[qstash] publish falló:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[qstash] error programando recordatorio:", e);
  }
}
