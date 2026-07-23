"use client";

import { useState, useMemo } from "react";
import {
  Search, X, Loader2, User, Flame, Activity, Zap, CheckCircle2, Circle,
  AlertTriangle, Info, MessageCircle, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserDetailAction } from "@/app/actions/admin-users";
import type { UserRow, UserDetail, UserStatus } from "@/lib/db/admin-users";

const STATUS_META: Record<UserStatus, { label: string; cls: string; dot: string }> = {
  nuevo: { label: "Nuevo", cls: "text-primary bg-primary/10", dot: "bg-primary" },
  activo: { label: "Activo", cls: "text-success bg-success/10", dot: "bg-success" },
  dormido: { label: "Dormido", cls: "text-warning bg-warning/10", dot: "bg-warning" },
  perdido: { label: "Perdido", cls: "text-danger bg-danger/10", dot: "bg-danger" },
  nunca: { label: "Sin activar", cls: "text-muted bg-surface-2", dot: "bg-muted-2" },
};
const SIGNAL_META = {
  danger: { icon: AlertTriangle, cls: "text-danger" },
  warning: { icon: AlertTriangle, cls: "text-warning" },
  info: { icon: Info, cls: "text-primary" },
};
const FILTERS: (UserStatus | "todos")[] = ["todos", "activo", "dormido", "perdido", "nunca", "nuevo"];

function rel(iso: string | null): string {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d}d`;
  return `hace ${Math.floor(d / 30)}m`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function UsersPanel({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserStatus | "todos">("todos");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.status] = (c[u.status] ?? 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) =>
      (filter === "todos" || u.status === filter) &&
      (!term || u.email.toLowerCase().includes(term) || (u.name ?? "").toLowerCase().includes(term))
    );
  }, [users, q, filter]);

  const open = async (u: UserRow) => {
    setSelected(u);
    setDetail(null);
    setLoading(true);
    const res = await getUserDetailAction(u.id);
    setLoading(false);
    if (res.detail) setDetail(res.detail);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Usuarios ({users.length})</h2>
      </div>

      {/* Buscador + filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por email o nombre…"
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-foreground"
              )}
            >
              {f === "todos" ? "Todos" : STATUS_META[f].label}
              {f !== "todos" && counts[f] ? <span className="ml-1 opacity-70">{counts[f]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">Sin usuarios para este filtro.</p>
        ) : filtered.map((u) => {
          const s = STATUS_META[u.status];
          return (
            <button key={u.id} onClick={() => open(u)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2/40">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold uppercase text-muted">
                {(u.name || u.email).slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                  {u.name || u.email.split("@")[0]}
                  {u.isPremium && <Crown size={12} className="text-primary shrink-0" />}
                  {u.whatsapp && <MessageCircle size={12} className="text-success shrink-0" />}
                  {u.tester && <span className="rounded bg-surface-2 px-1 text-[9px] text-muted">TEST</span>}
                </p>
                <p className="text-[11px] text-muted truncate">{u.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.cls)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.label}
                </span>
                <p className="mt-0.5 text-[10px] text-muted">{u.tx} mov · {rel(u.lastActive)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <DetailModal user={selected} detail={detail} loading={loading} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function DetailModal({ user, detail, loading, onClose }: { user: UserRow; detail: UserDetail | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground truncate">{user.name || user.email.split("@")[0]}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
            <p className="mt-0.5 text-[11px] text-muted">Registrado {fmtDate(user.createdAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-foreground"><X size={18} /></button>
        </div>

        {loading || !detail ? (
          <div className="grid place-items-center py-14"><Loader2 size={22} className="animate-spin text-muted" /></div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Dónde se traba (lo más importante arriba) */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">Dónde se traba / cómo viene</p>
              <div className="space-y-1.5">
                {detail.signals.map((s, i) => {
                  const m = SIGNAL_META[s.tone];
                  return (
                    <p key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                      <m.icon size={13} className={cn("mt-0.5 shrink-0", m.cls)} /> <span>{s.text}</span>
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Tiles */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile icon={Zap} label="Activación" value={detail.activation.activated ? "Sí" : "No"} sub={detail.activation.daysToActivate != null ? `en ${detail.activation.daysToActivate}d` : "—"} accent={detail.activation.activated ? "text-success" : "text-danger"} />
              <Tile icon={Activity} label="Últ. actividad" value={rel(detail.activity.lastActive)} sub={`${detail.activity.activeDays30} días/30`} />
              <Tile icon={Activity} label="Movimientos" value={String(detail.engagement.txTotal)} sub={`${detail.engagement.tx30} en 30d`} />
              <Tile icon={Flame} label="Racha" value={String(detail.engagement.streakCurrent)} sub={`récord ${detail.engagement.streakLongest}`} />
            </div>

            {/* Onboarding */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">Onboarding ({detail.onboarding.completedCount}/{detail.onboarding.totalSteps})</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {[
                  ["Cuenta", detail.onboarding.hasAccount],
                  ["Categoría propia", detail.onboarding.hasCustomCategory],
                  ["1er movimiento", detail.onboarding.hasTransaction],
                  ["WhatsApp", detail.onboarding.hasWhatsapp],
                  ["Notificaciones", detail.onboarding.hasPushSubscription],
                ].map(([label, ok]) => (
                  <span key={label as string} className="flex items-center gap-1.5 text-xs">
                    {ok ? <CheckCircle2 size={13} className="text-success" /> : <Circle size={13} className="text-muted/40" />}
                    <span className={ok ? "text-foreground" : "text-muted"}>{label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Features que usa (dónde trabaja) */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">Dónde trabaja (features)</p>
              <div className="space-y-1.5">
                {detail.features.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-muted">{f.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", f.used ? "bg-primary/70" : "")} style={{ width: f.used ? `${Math.min(100, 20 + f.count * 8)}%` : "0%" }} />
                    </div>
                    <span className={cn("w-8 shrink-0 text-right font-mono tabular-nums", f.used ? "text-foreground" : "text-muted/50")}>{f.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actividad semanal */}
            {detail.engagement.weekly.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">Movimientos por semana (8 sem)</p>
                <WeeklyBars data={detail.engagement.weekly} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, accent }: { icon: typeof Zap; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1 text-muted"><Icon size={12} /><p className="text-[9px] uppercase tracking-wider">{label}</p></div>
      <p className={cn("mt-1 text-lg font-bold font-mono tabular-nums", accent ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

function WeeklyBars({ data }: { data: { week: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d) => (
        <div key={d.week} className="flex flex-1 flex-col items-center gap-1" title={`${d.week}: ${d.count}`}>
          <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
          <span className="text-[8px] text-muted">{d.week.slice(8, 10)}/{d.week.slice(5, 7)}</span>
        </div>
      ))}
    </div>
  );
}
