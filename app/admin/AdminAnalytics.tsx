"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { MessageCircle, Mail, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AdminAnalytics as Data } from "@/lib/db/admin-stats";
import type { ResendDomainStatus } from "@/lib/email/domain-status";
import { ReactivationButton } from "./ReactivationButton";

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function rel(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function AdminAnalytics({ data, domainStatus, gmailReady }: { data: Data; domainStatus?: ResendDomainStatus; gmailReady?: boolean }) {
  const maxFunnel = data.funnel[0]?.value || 1;

  // Estado de envío de emails (reactivación depende de esto).
  // Gmail SMTP tiene prioridad: si está configurado, los emails salen por ahí
  // sin depender de verificar el dominio en Resend.
  const emailOk = gmailReady || (domainStatus?.state === "found" && domainStatus.verified);
  const emailWarn: string | null =
    gmailReady ? null
    : !domainStatus ? null
    : domainStatus.state === "no-key" ? "No hay canal de email: seteá GMAIL_USER + GMAIL_APP_PASSWORD en Vercel (recomendado) o verificá el dominio en Resend."
    : domainStatus.state === "not-found" ? `Sin Gmail configurado y el dominio ${domainStatus.domain} no está en Resend. Seteá GMAIL_USER + GMAIL_APP_PASSWORD en Vercel, o verificá el dominio.`
    : domainStatus.state === "found" && !domainStatus.verified ? `Sin Gmail configurado y el dominio ${domainStatus.domain} en Resend está SIN verificar. Seteá GMAIL_USER + GMAIL_APP_PASSWORD en Vercel, o verificá el dominio.`
    : domainStatus.state === "error" ? `No se pudo verificar el estado en Resend: ${domainStatus.message}`
    : null;
  const emailChannel = gmailReady ? "Gmail (control.io.oficial)" : "dominio verificado en Resend";

  return (
    <div className="space-y-10">
      {/* ── Evolución histórica ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Evolución — últimos 45 días
        </h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "var(--color-muted)" }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                labelFormatter={(l) => `Día ${shortDate(String(l))}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="movimientos" name="Movimientos" fill="#2563EB" radius={[3, 3, 0, 0]} barSize={8} />
              <Line dataKey="activos" name="Usuarios activos" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line dataKey="registros" name="Registros" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Embudo de activación ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Embudo de activación</h2>
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          {data.funnel.map((step, i) => {
            const pct = Math.round((step.value / maxFunnel) * 100);
            return (
              <div key={step.label} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 text-muted">{step.label}</span>
                <div className="flex-1 h-6 rounded-md bg-surface-2 overflow-hidden">
                  <div
                    className="h-full flex items-center justify-end pr-2 text-[11px] font-bold text-white transition-all"
                    style={{ width: `${Math.max(pct, 8)}%`, background: i === 0 ? "#64748b" : "#2563EB" }}
                  >
                    {pct}%
                  </div>
                </div>
                <span className="w-10 text-right font-mono tabular-nums text-foreground">{step.value}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WhatsApp vs engagement ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">WhatsApp ↔ engagement</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted flex items-center gap-1"><MessageCircle size={12} /> Con WhatsApp</p>
            <p className="text-2xl font-bold font-mono text-success mt-1">{data.whatsappAvg.conWa}</p>
            <p className="text-xs text-muted">movs promedio c/u</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted">Sin WhatsApp</p>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">{data.whatsappAvg.sinWa}</p>
            <p className="text-xs text-muted">movs promedio c/u</p>
          </div>
        </div>
      </section>

      {/* ── Usuarios conectados / activos ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Usuarios — actividad reciente ({data.connected.length})
        </h2>
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted border-b border-border">
                  <th className="text-left font-medium px-4 py-2.5">Usuario</th>
                  <th className="text-center font-medium px-2 py-2.5">WA</th>
                  <th className="text-right font-medium px-2 py-2.5">Movs</th>
                  <th className="text-right font-medium px-2 py-2.5">7d</th>
                  <th className="text-right font-medium px-4 py-2.5">Última act.</th>
                </tr>
              </thead>
              <tbody>
                {data.connected.map((u) => {
                  const active = u.lastActivity && Date.now() - new Date(u.lastActivity).getTime() < 2 * 86_400_000;
                  return (
                    <tr key={u.email} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground truncate max-w-[160px]">{u.name ?? "—"}</p>
                        <p className="text-[11px] text-muted truncate max-w-[160px]">{u.email}</p>
                      </td>
                      <td className="text-center px-2 py-2.5">{u.whatsapp ? "✅" : "—"}</td>
                      <td className="text-right px-2 py-2.5 font-mono tabular-nums text-foreground">{u.movs}</td>
                      <td className="text-right px-2 py-2.5 font-mono tabular-nums text-muted">{u.movs7}</td>
                      <td className="text-right px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${active ? "text-success" : "text-muted"}`}>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                          {rel(u.lastActivity)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Reactivación ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Reactivación de inactivos
        </h2>
        {emailWarn ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-danger leading-relaxed">
              <strong>Los emails de reactivación NO se están enviando.</strong> {emailWarn} Hasta que esto se
              resuelva, &ldquo;Enviar ahora&rdquo; y el cron diario fallan sin mandar nada.
            </p>
          </div>
        ) : emailOk ? (
          <div className="rounded-xl border border-success/40 bg-success/10 p-3 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" />
            <p className="text-xs text-success leading-relaxed">
              Envío de emails operativo vía <strong>{emailChannel}</strong>. &ldquo;Enviar ahora&rdquo; reactiva a los pendientes.
            </p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Pendientes */}
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                <Clock size={13} /> Pendientes de reactivar ({data.reactivation.pending.length})
              </p>
              <ReactivationButton pending={data.reactivation.pending.length} />
            </div>
            <p className="text-[11px] text-muted">Nunca activaron, o dormidos (+14d sin actividad). El cron les manda el email a las 10am, o tocá &ldquo;Enviar ahora&rdquo;.</p>
            {data.reactivation.pending.length === 0 ? (
              <p className="text-xs text-muted pt-1">Nadie pendiente 🎉</p>
            ) : (
              <ul className="space-y-1 pt-1">
                {data.reactivation.pending.slice(0, 14).map((u) => (
                  <li key={u.email} className="text-xs text-foreground flex justify-between gap-2">
                    <span className="truncate">{u.name ?? u.email}</span>
                    <span className={`shrink-0 ${u.dormant ? "text-amber-500" : "text-muted"}`}>
                      {u.dormant ? "dormido" : "nunca activó"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Enviados */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Mail size={13} /> Email de reactivación enviado ({data.reactivation.sentCount})
            </p>
            {data.reactivation.sent.length === 0 ? (
              <p className="text-xs text-muted pt-1">Todavía no se envió ninguno.</p>
            ) : (
              <ul className="space-y-1 pt-1">
                {data.reactivation.sent.slice(0, 12).map((u) => (
                  <li key={u.email} className="text-xs text-foreground flex justify-between gap-2">
                    <span className="truncate">{u.name ?? u.email}</span>
                    <span className="text-muted shrink-0">{rel(u.sentAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
