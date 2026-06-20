import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/feature-flags";
import { getTasks } from "@/lib/db/tasks";
import { getPendingReminders } from "@/lib/db/reminders";
import { getGoogleStatus, listCalendarEvents } from "@/lib/google";
import { CalendarioClient, type Cell, type CalItem } from "./CalendarioClient";

export const metadata: Metadata = { title: "Calendario" };

const ARG_TZ = "America/Argentina/Buenos_Aires";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const argDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ARG_TZ });
const argTime = (d: Date) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: ARG_TZ });

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { isTester: true } });
  const isTester = profile?.isTester ?? false;
  if (!hasFeature("tareas", { isTester })) redirect("/dashboard");

  const { month } = await searchParams;
  const todayArg = argDay(new Date());
  const [defY, defM] = todayArg.split("-").map(Number);
  let year = defY;
  let mon = defM;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    year = Number(month.slice(0, 4));
    mon = Number(month.slice(5, 7));
  }

  const first = new Date(Date.UTC(year, mon - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - first.getUTCDay());
  const baseCells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return { key: d.toISOString().slice(0, 10), dayNum: d.getUTCDate(), inMonth: d.getUTCMonth() === mon - 1 };
  });
  const rangeFrom = new Date(gridStart);
  const rangeTo = new Date(gridStart);
  rangeTo.setUTCDate(gridStart.getUTCDate() + 42);

  const [tasks, reminders, gstatus] = await Promise.all([
    getTasks(user.id).catch(() => []),
    getPendingReminders(user.id).catch(() => []),
    getGoogleStatus(user.id).catch(() => ({ connected: false, email: null })),
  ]);
  const googleEnabled = hasFeature("google", { isTester });
  const events = googleEnabled && gstatus.connected
    ? await listCalendarEvents(user.id, { from: rangeFrom, to: rangeTo }).catch(() => [])
    : [];

  const byDay = new Map<string, CalItem[]>();
  const push = (key: string, it: CalItem) => {
    const arr = byDay.get(key) ?? [];
    arr.push(it);
    byDay.set(key, arr);
  };
  for (const e of events) {
    if (!e.start) continue;
    const hasTime = e.start.includes("T");
    const key = hasTime ? argDay(new Date(e.start)) : e.start.slice(0, 10);
    push(key, { id: e.id, label: e.summary, time: hasTime ? argTime(new Date(e.start)) : "", kind: "event" });
  }
  for (const t of tasks) {
    if (t.done || !t.dueDate) continue;
    push(argDay(new Date(t.dueDate)), { id: null, label: t.title, time: "", kind: "task" });
  }
  for (const r of reminders) {
    push(argDay(new Date(r.remindAt)), { id: null, label: r.text, time: argTime(new Date(r.remindAt)), kind: "reminder" });
  }
  for (const arr of byDay.values()) arr.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  const cells: Cell[] = baseCells.map((c) => ({ ...c, items: byDay.get(c.key) ?? [] }));
  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, "0")}`;
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;

  return (
    <CalendarioClient
      cells={cells}
      initialTasks={tasks}
      monthLabel={`${MESES[mon - 1]} ${year}`}
      todayArg={todayArg}
      prevMonth={prevMonth}
      nextMonth={nextMonth}
      googleConnected={gstatus.connected}
      googleEnabled={googleEnabled}
    />
  );
}
