"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Check, ChevronRight, FileText, Newspaper, ReceiptText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppNotification = {
  id: string;
  kind: "newsletter" | "reminder" | "due" | "report";
  title: string;
  description: string;
  href: string;
};

const icons = {
  newsletter: Newspaper,
  reminder: CalendarClock,
  due: ReceiptText,
  report: FileText,
};

export function NotificationCenter({
  notifications,
  mobile = false,
}: {
  notifications: AppNotification[];
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = notifications.length;

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={count ? `Notificaciones, ${count} pendientes` : "Notificaciones"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex items-center justify-center border border-border bg-surface text-muted transition-colors hover:text-foreground",
          mobile ? "h-10 w-10 rounded-xl" : "h-9 w-9 rounded-xl"
        )}
      >
        <Bell size={mobile ? 18 : 16} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centro de notificaciones"
          className={cn(
            "z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
            mobile
              ? "fixed left-3 right-3 top-[calc(3.75rem+env(safe-area-inset-top,0px))]"
              : "absolute right-0 top-11 w-[23rem]"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notificaciones</p>
              <p className="text-xs text-muted">
                {count ? `${count} ${count === 1 ? "aviso pendiente" : "avisos pendientes"}` : "Todo está al día"}
              </p>
            </div>
            <Link
              href="/configuracion"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Configurar notificaciones"
            >
              <Settings size={16} />
            </Link>
          </div>

          {count > 0 ? (
            <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-1.5">
              {notifications.map((notification) => {
                const Icon = icons[notification.kind];
                return (
                  <Link
                    key={notification.id}
                    href={notification.href}
                    onClick={() => setOpen(false)}
                    className="group flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-tight text-foreground">
                        {notification.title}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted">
                        {notification.description}
                      </span>
                    </span>
                    <ChevronRight size={15} className="mt-2 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-5 py-8 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                <Check size={20} />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">No tenés avisos pendientes</p>
              <p className="mt-1 max-w-[28ch] text-xs leading-relaxed text-muted">
                Los recordatorios, vencimientos y novedades aparecerán acá.
              </p>
            </div>
          )}

          <Link
            href="/hoy"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-3 text-center text-xs font-medium text-primary transition-colors hover:bg-surface-2"
          >
            Ver el plan de hoy
          </Link>
        </div>
      )}
    </div>
  );
}
