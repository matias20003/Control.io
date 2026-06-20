import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getTasks } from "@/lib/db/tasks";
import { getPendingReminders } from "@/lib/db/reminders";
import { getGoogleStatus, listCalendarEvents } from "@/lib/google";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Calendario" };

const ARG_TZ = "America/Argentina/Buenos_Aires";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "YYYY-MM-DD" del instante en zona ARG.
function argDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: ARG_TZ });
}
// "HH:mm" en ARG.
function argTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: ARG_TZ });
}

type Item = { label: string; time: string; kind: "event" | "task" | "reminder" };

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { isTester: true } });
  const isTester = profile?.isTester ?? false;
  if (!hasFeature("tareas", { isTester })) redirect("/dashboard");

  // Mes a mostrar (default: mes actual en ARG).
  const { month } = await searchParams;
  const todayArg = argDay(new Date()); // YYYY-MM-DD
  const [defY, defM] = todayArg.split("-").map(Number);
  let year = defY;
  let mon = defM; // 1-12
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    year = Number(month.slice(0, 4));
    mon = Number(month.slice(5, 7));
  }

  // Grilla: desde el domingo previo al 1°, 6 semanas (42 celdas). Usamos UTC
  // como "fecha calendario" abstracta (todas las celdas en la misma base).
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - first.getUTCDay()); // retrocede al domingo
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return { key: d.toISOString().slice(0, 10), dayNum: d.getUTCDate(), inMonth: d.getUTCMonth() === mon - 1 };
  });
  const rangeFrom = new Date(gridStart);
  const rangeTo = new Date(gridStart);
  rangeTo.setUTCDate(gridStart.getUTCDate() + 42);

  // Datos.
  const [tasks, reminders, gstatus] = await Promise.all([
    getTasks(user.id).catch(() => []),
    getPendingReminders(user.id).catch(() => []),
    getGoogleStatus(user.id).catch(() => ({ connected: false, email: null })),
  ]);
  const googleEnabled = hasFeature("google", { isTester });
  const events = googleEnabled && gstatus.connected
    ? await listCalendarEvents(user.id, { from: rangeFrom, to: rangeTo }).catch(() => [])
    : [];

  // Agrupar todo por día (ARG).
  const byDay = new Map<string, Item[]>();
  const push = (key: string, it: Item) => {
    const arr = byDay.get(key) ?? [];
    arr.push(it);
    byDay.set(key, arr);
  };
  for (const e of events) {
    if (!e.start) continue;
    const hasTime = e.start.includes("T");
    const key = hasTime ? argDay(new Date(e.start)) : e.start.slice(0, 10);
    push(key, { label: e.summary, time: hasTime ? argTime(new Date(e.start)) : "", kind: "event" });
  }
  for (const t of tasks) {
    if (t.done || !t.dueDate) continue;
    push(argDay(new Date(t.dueDate)), { label: t.title, time: "", kind: "task" });
  }
  for (const r of reminders) {
    push(argDay(new Date(r.remindAt)), { label: r.text, time: argTime(new Date(r.remindAt)), kind: "reminder" });
  }
  // Ordenar por hora dentro de cada día.
  for (const arr of byDay.values()) arr.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, "0")}`;
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const dot = { event: "bg-primary", task: "bg-success", reminder: "bg-amber-500" } as const;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground capitalize">{MESES[mon - 1]} {year}</h1>
        <div className="flex items-center gap-1.5">
          <Link href="/calendario" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground">Hoy</Link>
          <Link href={`/calendario?month=${prevMonth}`} className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground"><ChevronLeft size={16} /></Link>
          <Link href={`/calendario?month=${nextMonth}`} className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground"><ChevronRight size={16} /></Link>
          <Link href="/tareas" className="ml-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground">Lista</Link>
        </div>
      </div>

      {!gstatus.connected && googleEnabled && (
        <Link href="/configuracion" className="block rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-muted hover:border-primary/50">
          Conectá tu Google Calendar para ver tus eventos en el calendario →
        </Link>
      )}

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 gap-px text-center text-[11px] font-semibold text-muted">
        {["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {cells.map((c) => {
          const items = byDay.get(c.key) ?? [];
          const isToday = c.key === todayArg;
          return (
            <div key={c.key} className={`min-h-[92px] bg-surface p-1.5 ${c.inMonth ? "" : "opacity-40"}`}>
              <div className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${isToday ? "bg-primary text-white" : "text-muted"}`}>
                {c.dayNum}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((it, i) => (
                  <div key={i} className="flex items-center gap-1 truncate text-[10px] text-foreground" title={`${it.time} ${it.label}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[it.kind]}`} />
                    <span className="truncate">{it.time && <span className="text-muted">{it.time} </span>}{it.label}</span>
                  </div>
                ))}
                {items.length > 3 && <p className="text-[10px] text-muted">+{items.length - 3} más</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Eventos (Calendar)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Tareas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Recordatorios</span>
      </div>
    </div>
  );
}
