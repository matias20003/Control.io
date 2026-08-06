import {
  ArrowUpDown, BarChart3, CalendarDays, CalendarCheck, CircleDollarSign, Compass, CreditCard, Eye,
  Flame, GraduationCap, HandCoins, HeartHandshake, LayoutDashboard, ListChecks, Mail, Newspaper,
  Rss, Sparkles, Sprout, Target, Users, Wallet,
} from "lucide-react";

/**
 * Los tres pilares de Control.io. La app dejó de ser sólo finanzas: controlar
 * la plata, controlar el tiempo y sostener los vínculos son tres trabajos
 * distintos, y mezclar sus quince secciones en una lista plana obligaba a
 * leerlas todas para encontrar una.
 *
 * Cada pilar abre con su propio dashboard y despliega sus secciones debajo.
 * Inicio queda arriba, fuera de los tres: es el resumen que los cruza.
 */
export type NavArea = "finanzas" | "organizacion" | "circulo";

export type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  /** Rutas extra que dejan este ítem activo (subsecciones que no tienen botón propio). */
  match?: string[];
  /** Sólo visible para el dueño (gate por ADMIN_EMAIL en el layout). */
  ownerOnly?: boolean;
};

export type Area = {
  label: string;
  icon: React.ElementType;
  /** El dashboard del pilar: a dónde lleva tocar su nombre. */
  home: string;
  items: NavItem[];
};

/** Fuera de los pilares: resume los tres. */
export const HOME_ITEM: NavItem = { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" };

export const AREAS: Record<NavArea, Area> = {
  finanzas: {
    label: "Finanzas",
    icon: Wallet,
    home: "/finanzas",
    items: [
      { href: "/finanzas",     icon: BarChart3,        label: "Resumen" },
      { href: "/movimientos",  icon: ArrowUpDown,      label: "Movimientos" },
      { href: "/cuentas",      icon: Wallet,           label: "Cuentas" },
      { href: "/presupuestos", icon: Target,           label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
      { href: "/deudas",       icon: HandCoins,        label: "Deudas" },
      { href: "/cuotas",       icon: CreditCard,       label: "Cuotas" },
      { href: "/grupos",       icon: Users,            label: "Grupos" },
      { href: "/reporte",      icon: BarChart3,        label: "Análisis", match: ["/reporte", "/tendencias", "/gastos-hormiga"] },
      { href: "/cotizaciones", icon: CircleDollarSign, label: "Cotizaciones" },
    ],
  },
  organizacion: {
    label: "Organización",
    icon: CalendarCheck,
    home: "/organizacion",
    items: [
      { href: "/organizacion", icon: BarChart3,     label: "Resumen" },
      { href: "/hoy",          icon: Sparkles,      label: "Hoy" },
      { href: "/calendario",   icon: CalendarDays,  label: "Calendario", match: ["/calendario", "/agenda"] },
      { href: "/tareas",       icon: ListChecks,    label: "Tareas" },
      { href: "/habitos",      icon: Flame,         label: "Hábitos" },
      { href: "/estudio",      icon: GraduationCap, label: "Estudio" },
      { href: "/correos",      icon: Mail,          label: "Correos", ownerOnly: true },
    ],
  },
  circulo: {
    label: "Mi Círculo",
    icon: Users,
    home: "/circulo",
    items: [
      { href: "/circulo",             icon: Newspaper,     label: "La ración" },
      { href: "/circulo/cercanos",    icon: HeartHandshake, label: "Cercanos" },
      { href: "/circulo/referentes",  icon: Rss,           label: "Referentes" },
      { href: "/circulo/norte",       icon: Compass,       label: "El Norte" },
      { href: "/circulo/cosecha",     icon: Sprout,        label: "La Cosecha" },
      { href: "/circulo/espejo",      icon: Eye,           label: "El Espejo" },
    ],
  },
};

export const AREA_ORDER: NavArea[] = ["finanzas", "organizacion", "circulo"];

export const NAV_AREA_STORAGE_KEY = "controlio:nav-area";

/**
 * El menú de siempre, plano, que sigue viendo todo el mundo. Los tres pilares
 * de arriba están en prueba y sólo los ve el dueño: mover de lugar quince
 * secciones para todos, antes de saber si el reordenamiento funciona, deja a
 * la gente buscando cosas que ayer encontraba de memoria.
 *
 * Cuando el rediseño esté probado, esto se borra y AREAS queda para todos.
 */
export const LEGACY_ITEMS: NavItem[] = [
  { href: "/dashboard",    icon: LayoutDashboard,  label: "Inicio" },
  { href: "/calendario",   icon: CalendarCheck,    label: "Organización", match: ["/calendario", "/tareas"] },
  { href: "/movimientos",  icon: ArrowUpDown,      label: "Movimientos" },
  { href: "/cuentas",      icon: Wallet,           label: "Cuentas" },
  { href: "/presupuestos", icon: Target,           label: "Planificá", match: ["/presupuestos", "/metas", "/recurrentes"] },
  { href: "/newsletter",   icon: Newspaper,        label: "Mi Brief" },
  { href: "/grupos",       icon: Users,            label: "Grupos" },
  { href: "/deudas",       icon: HandCoins,        label: "Deudas" },
  { href: "/cuotas",       icon: CreditCard,       label: "Cuotas" },
  { href: "/reporte",      icon: BarChart3,        label: "Análisis", match: ["/reporte", "/tendencias", "/gastos-hormiga"] },
  { href: "/cotizaciones", icon: CircleDollarSign, label: "Cotizaciones" },
  { href: "/estudio",      icon: GraduationCap,    label: "Estudio", ownerOnly: true },
  { href: "/correos",      icon: Mail,             label: "Correos", ownerOnly: true },
];

/** Todas las rutas del pilar: su dashboard más las de cada sección. */
const routesOf = (area: Area) => [area.home, ...area.items.flatMap((item) => item.match ?? [item.href])];

/**
 * A qué pilar pertenece la ruta actual, o null si está fuera de los tres
 * (Inicio, Configuración, Buscar). El pilar de la ruta manda sobre el elegido:
 * estando en Cuotas el menú tiene que abrir Finanzas, siempre.
 */
export function areaFromPath(pathname: string): NavArea | null {
  for (const key of AREA_ORDER) {
    const hit = routesOf(AREAS[key]).some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    );
    if (hit) return key;
  }
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
