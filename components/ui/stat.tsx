import type { ElementType, ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const ACCENT: Record<string, { text: string; bg: string }> = {
  primary: { text: "text-primary", bg: "bg-primary/10" },
  success: { text: "text-success", bg: "bg-success/10" },
  danger: { text: "text-danger", bg: "bg-danger/10" },
  warning: { text: "text-warning", bg: "bg-warning/10" },
  muted: { text: "text-muted", bg: "bg-surface-2" },
};

/** Tarjeta KPI reutilizable (label + valor mono + delta opcional + chart opcional). */
export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaGood,
  icon: Icon,
  accent = "primary",
  chart,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: string | null;
  deltaGood?: boolean;
  icon?: ElementType;
  accent?: keyof typeof ACCENT;
  chart?: ReactNode;
}) {
  const a = ACCENT[accent] ?? ACCENT.primary;
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="text-xl md:text-2xl font-bold font-mono text-foreground mt-1.5 leading-none truncate">
              {value}
            </p>
            {hint && <p className="text-[11px] text-muted mt-1.5">{hint}</p>}
            {delta != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 mt-2 text-xs font-semibold",
                  deltaGood ? "text-success" : "text-danger"
                )}
              >
                {deltaGood ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {delta}
              </span>
            )}
          </div>
          {Icon && (
            <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", a.bg)}>
              <Icon size={17} className={a.text} />
            </span>
          )}
        </div>
        {chart && <div className="mt-3">{chart}</div>}
      </CardContent>
    </Card>
  );
}

/** Encabezado de página: título + subtítulo + acciones a la derecha. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
