import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoFull, LogoIcon } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { DashboardMockAnimated } from "./DashboardMockAnimated";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  KeyRound,
  EyeOff,
  ServerCog,
  FileLock2,
  Wallet,
  ArrowUpDown,
  PiggyBank,
  Target,
  Repeat2,
  TrendingUp,
  HandCoins,
  BarChart3,
  DollarSign,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Sparkles,
  CheckCircle2,
  Zap,
  Brain,
  LineChart,
} from "lucide-react";

export const metadata = {
  title: "control.io — Tomá el control real de tu plata",
  description:
    "El sistema de finanzas personales pensado para Argentina. Movimientos, cuentas, metas, inversiones, deudas y reportes con seguridad bancaria. Sin spreadsheets, sin spam, sin tracking.",
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogged = Boolean(user);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <BackgroundFx />

      <SiteNav isLogged={isLogged} />

      <main className="relative">
        <Hero isLogged={isLogged} />
        <TrustStrip />
        <Pillars />
        <Features />
        <SecuritySection />
        <HowItWorks />
        <ForWho />
        <FAQ />
        <FinalCta isLogged={isLogged} />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ───────────────────────── Background FX ───────────────────────── */

function BackgroundFx() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* Soft top-right glow */}
      <div className="absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-[120px]" />
      {/* Secondary glow bottom-left */}
      <div className="absolute -bottom-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-secondary/15 blur-[120px]" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
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

function SiteNav({ isLogged }: { isLogged: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center">
          <span className="md:hidden"><LogoFull size="xs" /></span>
          <span className="hidden md:block"><LogoFull size="sm" /></span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#seguridad" className="transition hover:text-foreground">
            Seguridad
          </a>
          <a href="#como-funciona" className="transition hover:text-foreground">
            Cómo funciona
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isLogged ? (
            <Link href="/dashboard">
              <Button size="sm" className="gap-1.5">
                Ir al dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Ingresar
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="gap-1.5">
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ isLogged }: { isLogged: boolean }) {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-10 lg:py-32">
        {/* Left — copy */}
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="uppercase tracking-widest">
              Finanzas personales · Pensado para Argentina
            </span>
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tomá el control real de
            <br />
            <span className="text-primary">
              tu plata.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Reemplazá el Excel y los apps que venden tus datos. control.io
            unifica cuentas, movimientos, metas, inversiones, deudas y reportes
            en un sistema rápido, encriptado y diseñado para que finalmente
            sepas a dónde se va cada peso.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isLogged ? (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  Ir al dashboard
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Empezar gratis
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="secondary">
                    Ya tengo cuenta
                  </Button>
                </Link>
              </>
            )}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Sin tarjeta de crédito
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Pesos, USD y otras monedas
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Mobile + desktop
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Sin tracking de terceros
            </li>
          </ul>
        </div>

        {/* Right — dashboard mock animado */}
        <div className="relative lg:col-span-5">
          <DashboardMockAnimated />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/30 via-secondary/20 to-transparent blur-2xl" />

      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/80 p-5 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted">
            <LogoIcon size={14} />
            control.io / dashboard
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <KpiTile label="Patrimonio" value="$ 4.812.350" trend="+12,4%" up />
          <KpiTile label="Mes" value="+$ 218.900" trend="+5,1%" up />
          <KpiTile label="Ahorro" value="32,7%" trend="meta 30%" up />
        </div>

        {/* Mini chart */}
        <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="text-muted">Tendencia · 90 días</span>
            <span className="font-mono text-primary">+$ 612.400</span>
          </div>
          <Sparkline />
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          <ListRow
            icon={<Wallet className="h-4 w-4 text-primary" />}
            title="Sueldo · Mayo"
            sub="Cuenta sueldo · Galicia"
            value="+$ 1.420.000"
            positive
          />
          <ListRow
            icon={<CreditCard className="h-4 w-4 text-warning" />}
            title="Visa · Cuota 3 de 6"
            sub="Vence 14/05"
            value="-$ 86.500"
          />
          <ListRow
            icon={<TrendingUp className="h-4 w-4 text-success" />}
            title="USD · Plazo fijo"
            sub="Renta mensual"
            value="+US$ 142,80"
            positive
          />
        </div>
      </div>

      {/* Floating security pill */}
      <div className="absolute -bottom-4 left-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <ShieldCheck className="h-4 w-4 text-success" />
        <span className="text-muted">Cifrado AES-256</span>
      </div>
      <div className="absolute -top-3 right-6 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-muted">Tiempo real</span>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  trend,
  up,
}: {
  label: string;
  value: string;
  trend: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-foreground sm:text-base">
        {value}
      </div>
      <div
        className={`mt-1 text-[10px] ${
          up ? "text-success" : "text-danger"
        }`}
      >
        {trend}
      </div>
    </div>
  );
}

function ListRow({
  icon,
  title,
  sub,
  value,
  positive,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface">
          {icon}
        </div>
        <div>
          <div className="text-xs font-medium text-foreground">{title}</div>
          <div className="text-[10px] text-muted">{sub}</div>
        </div>
      </div>
      <div
        className={`font-mono text-xs ${
          positive ? "text-success" : "text-danger"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Sparkline() {
  // Decorative SVG sparkline
  const points =
    "0,40 20,32 40,36 60,28 80,30 100,22 120,24 140,18 160,20 180,12 200,14 220,8 240,10 260,4";
  return (
    <svg viewBox="0 0 260 50" className="h-14 w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,50 ${points} 260,50`}
        fill="url(#spark-fill)"
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ───────────────────────── Trust strip ───────────────────────── */

function TrustStrip() {
  const items = [
    { icon: ShieldCheck, label: "Encriptación TLS 1.3" },
    { icon: Lock, label: "AES-256 en reposo" },
    { icon: KeyRound, label: "Auth con Supabase" },
    { icon: EyeOff, label: "Sin tracking de terceros" },
    { icon: ServerCog, label: "Infra en Vercel" },
    { icon: FileLock2, label: "Aislamiento por usuario (RLS)" },
  ];
  return (
    <section className="border-y border-border/60 bg-surface/30 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Pillars ───────────────────────── */

function Pillars() {
  const pillars = [
    {
      icon: LineChart,
      title: "Visibilidad total",
      body: "Toda tu plata en un solo lugar: cuentas, tarjetas, plazos fijos, USD, inversiones y deudas. Sin Excel.",
    },
    {
      icon: Brain,
      title: "Decisiones más rápidas",
      body: "Tendencias, presupuestos y reportes que te dicen exactamente dónde recortar y dónde duplicar.",
    },
    {
      icon: Target,
      title: "Disciplina sin esfuerzo",
      body: "Recurrentes, cuotas y metas con avance automático. Las cosas pasan solas para que vos no te olvides.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeader
        eyebrow="Por qué control.io"
        title="Hecho para que la plata deje de ser un misterio."
        sub="Una plataforma, tres efectos. Diseñada para gente que quiere ver resultado real sobre su patrimonio."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur transition hover:border-primary/40 hover:bg-surface"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
            <div className="relative">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background/60">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Features ───────────────────────── */

function Features() {
  const features = [
    {
      icon: ArrowUpDown,
      title: "Movimientos ágiles",
      body: "Cargá ingresos y gastos en segundos, con categorías, etiquetas y multi-moneda.",
    },
    {
      icon: Wallet,
      title: "Cuentas y billeteras",
      body: "Bancos, MercadoPago, efectivo, USD físicos, plazos fijos. Todo unificado.",
    },
    {
      icon: PiggyBank,
      title: "Presupuestos inteligentes",
      body: "Definí límites por categoría y recibí alertas antes de pasarte.",
    },
    {
      icon: Target,
      title: "Metas con progreso",
      body: "Ahorrá para el viaje, el departamento o el auto con avance visible.",
    },
    {
      icon: Repeat2,
      title: "Recurrentes",
      body: "Sueldos, alquileres, suscripciones: se cargan solos cada mes.",
    },
    {
      icon: CreditCard,
      title: "Cuotas",
      body: "Seguimiento de cuotas de tarjeta y compras en planes con vencimiento por mes.",
    },
    {
      icon: TrendingUp,
      title: "Inversiones",
      body: "Acciones, cripto, plazos fijos, fondos. Rentabilidad real, no proyectada.",
    },
    {
      icon: HandCoins,
      title: "Deudas y préstamos",
      body: "Cuánto debés, a quién y para cuándo. Cierre limpio sin sorpresas.",
    },
    {
      icon: BarChart3,
      title: "Tendencias",
      body: "Patrimonio, ingresos y gastos a lo largo del tiempo. Patrones que no veías.",
    },
    {
      icon: ClipboardList,
      title: "Reporte semanal",
      body: "Un resumen claro de tu semana financiera, listo cada lunes.",
    },
    {
      icon: DollarSign,
      title: "Cotizaciones",
      body: "Dólar oficial, blue, MEP, CCL y cripto sincronizado para conversiones reales.",
    },
    {
      icon: CalendarClock,
      title: "Agenda financiera",
      body: "Vencimientos, pagos y obligaciones en un calendario que avisa a tiempo.",
    },
  ];

  return (
    <section
      id="features"
      className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHeader
        eyebrow="Features"
        title="Todo lo que necesitás. Nada de lo que sobra."
        sub="Cada módulo está pensado para una decisión real. Sin paneles de juguete ni gráficos que adornan."
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group relative rounded-xl border border-border bg-surface/50 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-border transition group-hover:ring-primary/40">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
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

/* ───────────────────────── Security (the big one) ───────────────────────── */

function SecuritySection() {
  const items = [
    {
      icon: Lock,
      title: "Encriptación end-to-end",
      body: "TLS 1.3 en tránsito y AES-256 en reposo. Tus datos viajan y se guardan cifrados, siempre.",
    },
    {
      icon: KeyRound,
      title: "Autenticación robusta",
      body: "Login basado en Supabase Auth con tokens firmados y expiración corta. Nunca guardamos tu contraseña en claro.",
    },
    {
      icon: FileLock2,
      title: "Aislamiento por usuario",
      body: "Row Level Security en base de datos: cada cuenta solo puede leer y escribir sus propios registros. Nada compartido por error.",
    },
    {
      icon: EyeOff,
      title: "Cero tracking de terceros",
      body: "Sin Google Analytics, sin Facebook Pixel, sin trackers publicitarios. Tu navegación dentro de la app es solo tuya.",
    },
    {
      icon: ServerCog,
      title: "Infra de clase mundial",
      body: "Hosting en Vercel y base de datos administrada con backups automáticos y monitoreo 24/7.",
    },
    {
      icon: ShieldCheck,
      title: "Borrado total a un click",
      body: "Si te vas, te vas. Eliminás tu cuenta y todos tus datos quedan fuera de nuestros sistemas.",
    },
  ];

  return (
    <section
      id="seguridad"
      className="relative border-y border-border/60 bg-surface/30 backdrop-blur"
    >
      {/* Big background shield */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.04]"
      >
        <ShieldCheck className="h-[44rem] w-[44rem] text-primary" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">
                Tu plata es tuya. Tus datos también.
              </span>
            </div>

            <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Seguridad pensada como
              <span className="block bg-gradient-to-r from-success to-primary bg-clip-text text-transparent">
                la base, no como un extra.
              </span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              Tus finanzas son la información más sensible que vas a confiarle a
              un sistema. Por eso construimos control.io con seguridad bancaria
              desde el primer commit: cifrado fuerte, aislamiento estricto y
              cero negocios con tus datos.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-background/60 p-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Promesa control.io
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Nunca vendemos, alquilamos ni compartimos tu información
                    financiera con terceros. No entrenamos modelos con tus
                    datos. Punto.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {items.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-background/60 p-5 backdrop-blur transition hover:border-success/30"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/10 ring-1 ring-success/20">
                  <Icon className="h-5 w-5 text-success" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Creá tu cuenta en 30 segundos",
      body: "Email + contraseña. Sin pedirte CBU, DNI ni datos de tarjeta.",
    },
    {
      n: "02",
      title: "Cargá tus cuentas y saldos",
      body: "Bancos, billeteras, USD físicos, inversiones. Vos decidís el detalle.",
    },
    {
      n: "03",
      title: "Mirá tu plata como nunca antes",
      body: "Movimientos, tendencias, metas y reportes empiezan a contarte la historia real.",
    },
  ];

  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
    >
      <SectionHeader
        eyebrow="Cómo funciona"
        title="De cero a control en menos de 5 minutos."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map(({ n, title, body }) => (
          <div
            key={n}
            className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-7 backdrop-blur"
          >
            <div className="font-mono text-5xl font-bold text-primary/30">
              {n}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── For who ───────────────────────── */

function ForWho() {
  const audiences = [
    {
      title: "Freelancers",
      body: "Ingresos irregulares, multi-moneda y facturación en cuotas. Sabé exactamente cuánto podés sacar este mes.",
    },
    {
      title: "Familias",
      body: "Presupuesto compartido, cuotas del colegio, supermercado y vacaciones bajo control sin discutir.",
    },
    {
      title: "Inversores",
      body: "Plazos fijos, dólares, acciones y cripto en una misma vista de patrimonio con tendencia real.",
    },
    {
      title: "Profesionales en relación de dependencia",
      body: "Tu sueldo cargado solo, tus gastos clasificados y tu tasa de ahorro real, todos los meses.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeader
        eyebrow="Para quién"
        title="Si te entra y te sale plata, control.io es para vos."
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map(({ title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-surface/50 p-5 transition hover:border-primary/30 hover:bg-surface"
          >
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function FAQ() {
  const items = [
    {
      q: "¿Tengo que conectar mi banco?",
      a: "No. control.io funciona 100% por carga manual o asistida. No te pedimos credenciales bancarias ni acceso por scraping.",
    },
    {
      q: "¿Mis datos están seguros?",
      a: "Sí. Cifrado en tránsito (TLS 1.3) y en reposo (AES-256), aislamiento por usuario en base de datos (RLS) y cero trackers. Detalles en la sección de Seguridad.",
    },
    {
      q: "¿Puedo usarlo en el celular?",
      a: "Sí, control.io es responsive y se instala como app en iPhone y Android desde el navegador.",
    },
    {
      q: "¿Sirve para varias monedas?",
      a: "Sí. Pesos, dólares (oficial, blue, MEP, CCL) y otras monedas con cotizaciones sincronizadas para conversiones reales.",
    },
    {
      q: "¿Qué pasa si quiero borrar mi cuenta?",
      a: "Lo hacés desde Configuración. Tus datos se eliminan de nuestros sistemas. Sin trámites, sin emails de retención.",
    },
    {
      q: "¿Cuánto cuesta?",
      a: "Podés empezar a usarlo gratis ahora mismo. Si en algún momento lanzamos planes pagos, vas a ver siempre con anticipación qué cambia.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeader eyebrow="FAQ" title="Las dudas más comunes." />

      <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface/50 backdrop-blur">
        {items.map(({ q, a }) => (
          <details key={q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-left">
              <span className="text-sm font-semibold text-foreground sm:text-base">
                {q}
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-background text-muted transition group-open:rotate-45 group-open:border-primary/40 group-open:text-primary">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCta({ isLogged }: { isLogged: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 sm:pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface/80 to-background p-10 sm:p-14">
        {/* Decorative glow */}
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Empezá hoy a saber a dónde se va tu plata.
            </h2>
            <p className="mt-4 max-w-xl text-sm text-muted sm:text-base">
              Toma cinco minutos. Lo dejás cargado y nunca más volvés a abrir
              una planilla.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-4 lg:justify-end">
            {isLogged ? (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  Ir al dashboard
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Crear cuenta gratis
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="secondary">
                    Ingresar
                  </Button>
                </Link>
              </>
            )}
          </div>
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
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#seguridad" className="hover:text-foreground">
            Seguridad
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link href="/login" className="hover:text-foreground">
            Ingresar
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Crear cuenta
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 text-[10px] uppercase tracking-widest text-muted sm:px-8">
          <span>© {new Date().getFullYear()} control.io</span>
          <div className="flex items-center gap-4">
            <Link href="/terminos" className="hover:text-foreground transition-colors">
              Términos
            </Link>
            <Link href="/privacidad" className="hover:text-foreground transition-colors">
              Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Shared section header ───────────────────────── */

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
