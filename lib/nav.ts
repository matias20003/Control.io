import {
  ArrowUpDown, BarChart3, CalendarDays, CircleDollarSign, CreditCard, Flame,
  GraduationCap, HandCoins, LayoutDashboard, ListChecks, Mail, Newspaper,
  Sparkles, Target, Users, Wallet,
} from "lucide-react";

/**
 * Las dos áreas de Control.io. La app dejó de ser sólo finanzas: controlar la
 * plata y controlar el tiempo son dos trabajos distintos, y mezclar sus quince
 * secciones en una lista plana obligaba a leerlas todas para encontrar una.
 *
 * El sidebar muestra una sola área por vez y se cambia con un switch. Las
 * secciones transversales (Inicio, Mi Brief) quedan siempre arriba porque
 * hablan de las dos: el dashboard mezcla vencimientos con tareas del día.
 */
export type NavArea = "finanzas" | "organizacion";

export type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  /** Rutas extra que dejan este ítem activo (subsecciones que no tienen botón propio). */
  match?: string[];
  /** Sólo visible para el dueño (gate por ADMIN_EMAIL en el layout). */
  ownerOnly?: boolean;
};

/** Visibles en las dos áreas, arriba del switch. */
export const TRANSVERSAL_ITEMS: NavItem[] = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Inicio" },
  { href: "/newsletter", icon: Newspaper,       label: "Mi Brief" },
];

export const FINANCE_ITEMS: NavItem[] = [
  { href: "/movimientos",  icon: ArrowUpDown,      label: "Movimientos" },
  { href: "/cuentas",      icon: Wallet,           label: "Cuentas" },
  { href: "/presupuestos", icon: Target,           label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
  { href: "/deudas",       icon: HandCoins,        label: "Deudas" },
  { href: "/cuotas",       icon: CreditCard,       label: "Cuotas" },
  { href: "/grupos",       icon: Users,            label: "Grupos" },
  { href: "/reporte",      icon: BarChart3,        label: "Análisis", match: ["/reporte", "/tendencias", "/gastos-hormiga"] },
  { href: "/cotizaciones", icon: CircleDollarSign, label: "Cotizaciones" },
];

export const ORGANIZATION_ITEMS: NavItem[] = [
  { href: "/hoy",        icon: Sparkles,      label: "Hoy" },
  { href: "/calendario", icon: CalendarDays,  label: "Calendario", match: ["/calendario", "/agenda"] },
  { href: "/tareas",     icon: ListChecks,    label: "Tareas" },
  { href: "/habitos",    icon: Flame,         label: "Hábitos" },
  { href: "/estudio",    icon: GraduationCap, label: "Estudio" },
  { href: "/correos",    icon: Mail,          label: "Correos", ownerOnly: true },
];

export const AREAS: Record<NavArea, { label: string; home: string; items: NavItem[] }> = {
  finanzas:     { label: "Finanzas",     home: "/movimientos", items: FINANCE_ITEMS },
  organizacion: { label: "Organización", home: "/hoy",         items: ORGANIZATION_ITEMS },
};

export const NAV_AREA_STORAGE_KEY = "controlio:nav-area";

/** Todas las rutas que pertenecen a un área, incluidas las que no tienen botón propio. */
const routesOf = (items: NavItem[]) => items.flatMap((item) => item.match ?? [item.href]);
const FINANCE_ROUTES = routesOf(FINANCE_ITEMS);
const ORGANIZATION_ROUTES = routesOf(ORGANIZATION_ITEMS);

/**
 * A qué área pertenece la ruta actual, o null si es transversal (Inicio,
 * Mi Brief, Configuración, Buscar). El área de la ruta manda sobre la elección
 * guardada: estando en Cuotas el switch tiene que decir Finanzas, siempre.
 */
export function areaFromPath(pathname: string): NavArea | null {
  const hits = (routes: string[]) =>
    routes.some((route) => pathname === route || pathname.startsWith(route + "/"));
  if (hits(ORGANIZATION_ROUTES)) return "organizacion";
  if (hits(FINANCE_ROUTES)) return "finanzas";
  return null;
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  return (item.match ?? [item.href]).some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

/** Filtra lo que el usuario no puede ver. */
export function visibleItems(items: NavItem[], isOwner: boolean): NavItem[] {
  return items.filter((item) => !item.ownerOnly || isOwner);
}
