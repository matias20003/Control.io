import Link from "next/link";
import { LogoFull, LogoIcon } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpDown,
  Wallet,
  PiggyBank,
  Target,
  Repeat2,
  CreditCard,
  TrendingUp,
  HandCoins,
  BarChart3,
  ClipboardList,
  DollarSign,
  CalendarClock,
  LayoutDashboard,
  ShieldCheck,
  Lock,
  EyeOff,
  ServerCog,
  Zap,
  Smartphone,
  Globe,
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Check,
  ArrowDownUp,
  Bell,
  Database,
  KeyRound,
} from "lucide-react";

export const metadata = {
  title: "Presentación del sistema — control.io",
  description:
    "Recorrido completo por control.io: cómo funciona cada módulo, en qué se diferencia de Excel, apps internacionales y soluciones locales, y por qué es el único pensado para finanzas personales en Argentina.",
};

export default function PresentacionPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <BackgroundFx />
      <PresentacionNav />

      <main className="relative">
        <Hero />
        <ResumenEjecutivo />
        <FlujoDeUso />
        <ModulosDetallados />
        <Diferenciadores />
        <ComparativaTabla />
        <SoloControlIo />
        <SeguridadResumen />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ───────────────────────── Background ───────────────────────── */

function BackgroundFx() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[120px]" />
      <div className="absolute -bottom-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-secondary/10 blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 85%)",
        }}
      />
    </div>
  );
}

/* ───────────────────────── Nav ───────────────────────── */

function PresentacionNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center">
          <LogoFull />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#flujo" className="transition hover:text-foreground">
            Flujo
          </a>
          <a href="#modulos" className="transition hover:text-foreground">
            Módulos
          </a>
          <a href="#diferenciadores" className="transition hover:text-foreground">
            Diferenciadores
          </a>
          <a href="#comparativa" className="transition hover:text-foreground">
            Comparativa
          </a>
        </nav>

        <Link href="/login">
          <Button size="sm" className="gap-1.5">
            Acceder al sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs uppercase tracking-widest text-muted backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Presentación del sistema
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Así funciona{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              control.io
            </span>
            <br />
            por dentro.
          </h1>

          <p className="mt-6 text-base leading-relaxed text-muted sm:text-lg">
            Un recorrido honesto y completo por cada módulo del sistema, cómo se
            conectan entre sí y por qué es la única plataforma de finanzas
            personales pensada de cero para la realidad argentina.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Acceder al sistema
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href="#flujo">
              <Button size="lg" variant="secondary">
                Ver recorrido
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              13 módulos integrados
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Multi-moneda nativo
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Cero scraping bancario
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Resumen ejecutivo ───────────────────────── */

function ResumenEjecutivo() {
  const stats = [
    { value: "13", label: "Módulos integrados" },
    { value: "5", label: "Cotizaciones de USD en vivo" },
    { value: "0", label: "Trackers de terceros" },
    { value: "100%", label: "Datos cifrados" },
  ];
  return (
    <section className="border-y border-border/60 bg-surface/30 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
        {stats.map(({ value, label }) => (
          <div
            key={label}
            className="bg-background/60 px-5 py-7 text-center sm:px-8"
          >
            <div className="font-mono text-3xl font-bold text-primary sm:text-4xl">
              {value}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-muted">
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Flujo de uso ───────────────────────── */

function FlujoDeUso() {
  const steps = [
    {
      n: "01",
      title: "Capturás tu actividad",
      body: "Ingresos y gastos a mano o automáticos vía recurrentes y cuotas. Todo lo que entra y sale queda registrado con categoría, cuenta y moneda.",
      mods: ["Movimientos", "Recurrentes", "Cuotas"],
    },
    {
      n: "02",
      title: "Estructurás tu patrimonio",
      body: "Sumás cuentas bancarias, billeteras, dólares físicos, plazos fijos, inversiones y deudas. control.io arma tu foto patrimonial real.",
      mods: ["Cuentas", "Inversiones", "Deudas"],
    },
    {
      n: "03",
      title: "Planificás",
      body: "Definís presupuestos por categoría, metas de ahorro y una agenda con vencimientos. El sistema avisa antes de que te pases o te olvides.",
      mods: ["Presupuestos", "Metas", "Agenda"],
    },
    {
      n: "04",
      title: "Decidís con datos reales",
      body: "Dashboard, tendencias, reporte semanal y cotizaciones te muestran qué está pasando con tu plata y qué hacer con ella.",
      mods: ["Dashboard", "Tendencias", "Reporte semanal", "Cotizaciones"],
    },
  ];

  return (
    <section
      id="flujo"
      className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHeader
        eyebrow="El flujo"
        title="Cómo se usa el sistema, paso a paso."
        sub="control.io está pensado como una rutina financiera completa: cargar, estructurar, planificar y decidir. Cuatro etapas, todas integradas."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {steps.map(({ n, title, body, mods }) => (
          <div
            key={n}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-7 backdrop-blur"
          >
            <div className="flex items-start justify-between">
              <div className="font-mono text-5xl font-bold text-primary/30">
                {n}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {mods.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <h3 className="mt-4 text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Módulos detallados ───────────────────────── */

type Modulo = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  bullets: string[];
};

const modulos: Modulo[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "La foto unificada de tu plata: patrimonio neto, balance del mes, tasa de ahorro, próximos vencimientos y los movimientos recientes.",
    bullets: [
      "Patrimonio total convertido a la moneda que elijas",
      "KPIs de ingreso vs gasto del mes en curso",
      "Próximos pagos y deudas con semáforo de urgencia",
    ],
  },
  {
    icon: ArrowUpDown,
    title: "Movimientos",
    body: "El corazón del sistema. Cargás cada ingreso y gasto con categoría, etiquetas, cuenta de origen, fecha y moneda en pocos segundos.",
    bullets: [
      "Categorías y subcategorías personalizables",
      "Multi-moneda con conversión automática a la cotización del día",
      "Búsqueda, filtros y exportación a CSV",
    ],
  },
  {
    icon: Wallet,
    title: "Cuentas",
    body: "Modela tu mundo financiero real: bancos, MercadoPago, Ualá, efectivo en pesos, dólares físicos, plazos fijos, billeteras cripto.",
    bullets: [
      "Soporte nativo de varias monedas por cuenta",
      "Transferencias entre cuentas sin afectar tu patrimonio neto",
      "Saldos siempre conciliables con tu realidad",
    ],
  },
  {
    icon: Repeat2,
    title: "Recurrentes",
    body: "Sueldo, alquiler, expensas, suscripciones: lo cargás una vez y el sistema lo registra solo todos los meses, en la fecha que vos definas.",
    bullets: [
      "Frecuencia mensual, semanal, anual o custom",
      "Edición y pausa sin perder el histórico",
      "Aviso si una recurrente no se ejecutó como esperabas",
    ],
  },
  {
    icon: CreditCard,
    title: "Cuotas",
    body: "Las compras en planes de tarjeta dejan de ser una sorpresa. Cada cuota se proyecta al mes que corresponde y aparece en tu cashflow.",
    bullets: [
      "Compras 1, 3, 6, 12, 18 cuotas con cierre por tarjeta",
      "Vista por mes de cuántas cuotas vencen y cuánto suman",
      "Integración con presupuestos y agenda",
    ],
  },
  {
    icon: PiggyBank,
    title: "Presupuestos",
    body: "Definís un techo mensual por categoría (super, salidas, transporte, etc.) y el sistema te avisa cuando estás cerca o te pasaste.",
    bullets: [
      "Presupuestos por categoría y por cuenta",
      "Alertas configurables (50%, 80%, 100%)",
      "Comparativa real vs presupuestado al final del mes",
    ],
  },
  {
    icon: Target,
    title: "Metas",
    body: "Ahorrá para algo concreto: un viaje, el departamento, el auto, el fondo de emergencia. Visualizás avance, plazo y aporte sugerido.",
    bullets: [
      "Meta en pesos, dólares u otra moneda",
      "Aportes manuales o vinculados a movimientos",
      "Progreso en porcentaje y tiempo estimado de cumplimiento",
    ],
  },
  {
    icon: TrendingUp,
    title: "Inversiones",
    body: "Trackeás todo lo que tenés invertido — plazos fijos, acciones, fondos, cripto, USD físicos — y ves rentabilidad real en tiempo real.",
    bullets: [
      "Posiciones agrupadas por activo y broker",
      "Cotización de mercado actualizada para cada activo",
      "Rentabilidad nominal y ajustada por inflación",
    ],
  },
  {
    icon: HandCoins,
    title: "Deudas",
    body: "Registrás préstamos personales, deudas familiares, refinanciaciones. Sabés exactamente cuánto debés, a quién, con qué interés y para cuándo.",
    bullets: [
      "Cronograma de pagos automático",
      "Cierre parcial o total con un click",
      "Visibilidad consolidada en el dashboard",
    ],
  },
  {
    icon: BarChart3,
    title: "Tendencias",
    body: "Patrones de tu plata a lo largo del tiempo: cómo evolucionan tus ingresos, tus gastos por categoría y tu patrimonio neto.",
    bullets: [
      "Series mensuales, trimestrales y anuales",
      "Comparativas año contra año",
      "Detección de picos atípicos en gastos",
    ],
  },
  {
    icon: ClipboardList,
    title: "Reporte semanal",
    body: "Un informe claro y corto con lo que pasó esta semana en tu plata, listo para leer cada lunes en 30 segundos.",
    bullets: [
      "Top categorías de gasto de la semana",
      "Variación vs semana anterior y vs promedio",
      "Próximos vencimientos para los siguientes 7 días",
    ],
  },
  {
    icon: DollarSign,
    title: "Cotizaciones",
    body: "Dólar oficial, blue, MEP, CCL, cripto y otras monedas sincronizadas en vivo. Toda conversión del sistema usa el valor real del momento.",
    bullets: [
      "5 cotizaciones de USD argentinas en una sola vista",
      "Históricos para análisis de patrimonio en USD",
      "Convertidor instantáneo entre monedas",
    ],
  },
  {
    icon: CalendarClock,
    title: "Agenda financiera",
    body: "Un calendario que solo muestra lo que importa para tu plata: pagos, vencimientos, cuotas, cierres de tarjeta, vencimientos fiscales.",
    bullets: [
      "Vista mensual y semanal",
      "Notificaciones push antes de cada vencimiento",
      "Conexión directa con cuotas y recurrentes",
    ],
  },
];

function ModulosDetallados() {
  return (
    <section
      id="modulos"
      className="border-t border-border/60 bg-surface/20 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <SectionHeader
          eyebrow="Módulos"
          title="Cada parte del sistema, en detalle."
          sub="No es una colección de pantallas sueltas. Es un sistema en el que cada módulo alimenta al siguiente."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {modulos.map(({ icon: Icon, title, body, bullets }) => (
            <article
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-background/60 p-6 backdrop-blur transition hover:border-primary/40"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {body}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-xs text-muted"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Diferenciadores ───────────────────────── */

function Diferenciadores() {
  const items = [
    {
      icon: Globe,
      title: "Pensado para Argentina",
      body: "USD blue, MEP, CCL, cripto, inflación, cuotas de tarjeta, refinanciaciones. Conceptos nativos del sistema, no parches.",
    },
    {
      icon: ShieldCheck,
      title: "Sin scraping de bancos",
      body: "Nunca te vamos a pedir tu home banking. Cero riesgo de credenciales filtradas. Cero dependencia de APIs que se rompen.",
    },
    {
      icon: ArrowDownUp,
      title: "Multi-moneda real",
      body: "No es 'soporte para dólares', es modelo multi-moneda en cada cuenta, movimiento, presupuesto, meta e inversión.",
    },
    {
      icon: Zap,
      title: "Velocidad de uso",
      body: "Cargar un movimiento toma menos de 10 segundos. Sin formularios eternos ni pantallas que esperan a cargar gráficos pesados.",
    },
    {
      icon: Brain,
      title: "Decisiones, no decoración",
      body: "Cada gráfico responde una pregunta concreta. Si un panel no ayuda a decidir algo, no está.",
    },
    {
      icon: Smartphone,
      title: "Mobile y desktop reales",
      body: "Funciona como app en el celular y como herramienta de escritorio en la compu, con la misma profundidad en ambos.",
    },
  ];
  return (
    <section
      id="diferenciadores"
      className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHeader
        eyebrow="Diferenciadores"
        title="Lo que hace distinto a control.io."
        sub="No competimos con Excel, ni con apps internacionales, ni con planillas de Notion. Hacemos algo que ninguno de ellos puede hacer."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur transition hover:border-primary/30"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-5 text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Comparativa ───────────────────────── */

type Cell = "yes" | "partial" | "no";

const features: { label: string; row: [Cell, Cell, Cell, Cell] }[] = [
  { label: "Multi-moneda nativo (ARS, USD, cripto)", row: ["yes", "partial", "partial", "yes"] },
  { label: "USD blue / MEP / CCL en vivo", row: ["yes", "no", "no", "no"] },
  { label: "Cuotas de tarjeta como concepto nativo", row: ["yes", "no", "partial", "partial"] },
  { label: "Recurrentes automáticas", row: ["yes", "yes", "yes", "no"] },
  { label: "Presupuestos con alertas", row: ["yes", "yes", "yes", "no"] },
  { label: "Inversiones + plata diaria en una sola vista", row: ["yes", "no", "partial", "no"] },
  { label: "Reporte semanal automático", row: ["yes", "no", "no", "no"] },
  { label: "Sin trackers ni venta de datos", row: ["yes", "no", "no", "yes"] },
  { label: "Funciona en mobile como app", row: ["yes", "yes", "partial", "no"] },
  { label: "Sin necesidad de mantenimiento manual", row: ["yes", "yes", "yes", "no"] },
];

const cols = [
  { name: "control.io", highlight: true },
  { name: "Apps internacionales", note: "(Mint, YNAB, Copilot)" },
  { name: "Apps locales", note: "tipo billetera" },
  { name: "Excel / Notion", note: "" },
];

function ComparativaTabla() {
  return (
    <section
      id="comparativa"
      className="border-y border-border/60 bg-surface/20 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <SectionHeader
          eyebrow="Comparativa"
          title="control.io vs todo lo demás."
          sub="Una mirada honesta. Te decimos en qué te conviene control.io y en qué no."
        />

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-background/60 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60">
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">
                    Capacidad
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c.name}
                      className={`px-4 py-4 text-center text-xs uppercase tracking-widest ${
                        c.highlight
                          ? "text-primary"
                          : "text-muted"
                      }`}
                    >
                      <div className="font-semibold">{c.name}</div>
                      {c.note && (
                        <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal opacity-70">
                          {c.note}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map(({ label, row }) => (
                  <tr
                    key={label}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-5 py-3.5 text-foreground">{label}</td>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3.5 text-center ${
                          i === 0 ? "bg-primary/5" : ""
                        }`}
                      >
                        <CellIcon value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-success" />
          Soportado completo
          <span className="mx-3 opacity-40">·</span>
          <MinusCircle className="mr-1.5 inline h-3.5 w-3.5 text-warning" />
          Parcial o limitado
          <span className="mx-3 opacity-40">·</span>
          <XCircle className="mr-1.5 inline h-3.5 w-3.5 text-danger" />
          No soportado
        </p>
      </div>
    </section>
  );
}

function CellIcon({ value }: { value: Cell }) {
  if (value === "yes")
    return <CheckCircle2 className="mx-auto h-5 w-5 text-success" />;
  if (value === "partial")
    return <MinusCircle className="mx-auto h-5 w-5 text-warning" />;
  return <XCircle className="mx-auto h-5 w-5 text-danger/70" />;
}

/* ───────────────────────── Solo control.io ───────────────────────── */

function SoloControlIo() {
  const points = [
    {
      title: "Cinco cotizaciones del dólar en tiempo real",
      body: "Oficial, blue, MEP, CCL y cripto sincronizados. Tu patrimonio en USD se calcula con el tipo de cambio que vos elegís, no con uno arbitrario.",
    },
    {
      title: "Cuotas de tarjeta proyectadas al futuro",
      body: "Cuando cargás una compra en 6 cuotas, el sistema ya sabe cuánto vas a pagar en julio, agosto y septiembre. Tu cashflow es real, no estimativo.",
    },
    {
      title: "Sistema único: plata diaria + inversiones + deudas",
      body: "La mayoría de las apps separan 'gastos' de 'inversiones'. control.io las une porque tu patrimonio neto depende de las dos cosas a la vez.",
    },
    {
      title: "Reporte semanal automático cada lunes",
      body: "Sin abrir la app: recibís un resumen de la semana anterior con lo importante. Es la forma más rápida de mantener disciplina financiera.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeader
        eyebrow="Único en el mercado"
        title="Lo que solo vas a encontrar acá."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {points.map(({ title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent p-6"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-background">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Seguridad resumen ───────────────────────── */

function SeguridadResumen() {
  const items = [
    { icon: Lock, label: "AES-256 en reposo · TLS 1.3 en tránsito" },
    { icon: KeyRound, label: "Auth con tokens firmados (Supabase)" },
    { icon: Database, label: "Aislamiento por usuario en base (RLS)" },
    { icon: EyeOff, label: "Cero trackers de terceros" },
    { icon: ServerCog, label: "Infra Vercel + backups automáticos" },
    { icon: Bell, label: "Notificaciones push end-to-end" },
  ];
  return (
    <section className="border-y border-border/60 bg-surface/30 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs uppercase tracking-widest text-success">
              <ShieldCheck className="h-3.5 w-3.5" /> Seguridad
            </div>
            <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Construido con seguridad bancaria desde el primer commit.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              No vendemos, no compartimos, no entrenamos modelos con tu
              información financiera. Te lo prometemos por escrito y lo
              respaldamos en código.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {items.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 backdrop-blur"
              >
                <Icon className="h-4 w-4 shrink-0 text-success" />
                <span className="text-xs text-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 pb-24 sm:px-8 sm:py-24 sm:pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface/80 to-background p-10 sm:p-16">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <LogoIcon size={48} className="mx-auto" />
          <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Ya viste cómo funciona.
            <br />
            Ahora probalo.
          </h2>
          <p className="mt-4 text-sm text-muted sm:text-base">
            Accedé al sistema con tu cuenta y empezá a tener visibilidad real
            sobre tu plata en menos de 5 minutos.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Acceder al sistema
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="secondary">
                No tengo cuenta
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted">
            Sin tarjeta de crédito. Sin compromiso. Tu información, siempre tuya.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
        <div>
          <LogoFull size="sm" />
          <p className="mt-3 max-w-sm text-xs text-muted">
            Tu sistema de finanzas personales. Diseñado para Argentina.
            Construido con seguridad bancaria.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
          <Link href="/" className="hover:text-foreground">
            Inicio
          </Link>
          <a href="#flujo" className="hover:text-foreground">
            Flujo
          </a>
          <a href="#modulos" className="hover:text-foreground">
            Módulos
          </a>
          <a href="#comparativa" className="hover:text-foreground">
            Comparativa
          </a>
          <Link href="/login" className="hover:text-foreground">
            Acceder
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 text-[10px] uppercase tracking-widest text-muted sm:px-8">
          <span>© {new Date().getFullYear()} control.io</span>
          <span>Systematic efficiency</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Section header ───────────────────────── */

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs uppercase tracking-widest text-muted backdrop-blur">
        {eyebrow}
      </div>
      <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          {sub}
        </p>
      )}
    </div>
  );
}
