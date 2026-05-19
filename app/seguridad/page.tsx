import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  EyeOff,
  Lock,
  KeyRound,
  Eye,
  ServerCog,
  Check,
  X,
  Code2,
} from "lucide-react";
import { LogoFull } from "@/components/layout/Logo";

export const metadata: Metadata = {
  title: "Seguridad y privacidad — control.io",
  description:
    "Cómo cifra control.io tus finanzas. Qué podemos ver y qué no, con honestidad total.",
};

export default function SeguridadPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/70 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <LogoFull size="xs" />
          </Link>
          <Link
            href="/register"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Crear cuenta →
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 space-y-12">

        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success/15 ring-1 ring-success/30 mb-2">
            <ShieldCheck className="h-7 w-7 text-success" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            No podemos leer tu plata.
            <br />
            <span className="text-success">Literalmente.</span>
          </h1>
          <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
            Esta página explica con honestidad qué guarda control.io de vos,
            qué podemos ver los desarrolladores y qué no, y cómo lo verificás
            por tu cuenta si tenés ganas.
          </p>
        </section>

        {/* Lo que NO podemos ver — la promesa fuerte */}
        <section className="rounded-2xl border border-success/30 bg-success/5 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <EyeOff className="h-5 w-5 text-success" strokeWidth={2} />
            <h2 className="text-lg font-semibold">Lo que NO podemos leer</h2>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Estos datos están <strong className="text-foreground">cifrados con AES-256-GCM</strong> antes
            de guardarse en la base de datos. Aunque entremos a la base con
            permisos máximos, solo vemos texto ilegible tipo{" "}
            <code className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">
              enc:Qm9s9Xz3...
            </code>:
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "La descripción de cada movimiento (ej. \"almuerzo Don Julio\")",
              "Las notas que agregues a cada movimiento",
              "Los nombres de tus cuentas (ej. \"Galicia sueldo\", \"USD escondidos\")",
              "Los nombres en deudas, inversiones y metas",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Lo que SÍ vemos — honestidad */}
        <section className="rounded-2xl border border-warning/30 bg-warning/5 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Eye className="h-5 w-5 text-warning" strokeWidth={2} />
            <h2 className="text-lg font-semibold">Lo que SÍ podemos ver (no te mentimos)</h2>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Para que la app funcione, hay datos que no podemos cifrar (sino
            no podríamos hacer cálculos ni mostrarte gráficos). Estos son:
          </p>
          <ul className="space-y-2 text-sm">
            {[
              { ok: false, line: "Tu email (lo necesitamos para mandarte el código de acceso)" },
              { ok: false, line: "Los montos en pesos / dólares de cada movimiento (sin saber a qué corresponden)" },
              { ok: false, line: "Las fechas de tus movimientos y cuándo te registraste" },
              { ok: false, line: "La cantidad de cuentas que tenés (sin sus nombres ni saldos identificables)" },
            ].map((item) => (
              <li key={item.line} className="flex items-start gap-2">
                <X className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <span>{item.line}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted leading-relaxed pt-2 border-t border-warning/15">
            Traducción honesta: podemos ver que gastaste $50.000 el martes
            pasado, <strong className="text-foreground">pero no en qué.</strong>
          </p>
        </section>

        {/* Cómo está cifrado — técnico pero amigable */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-primary" strokeWidth={2} />
            <h2 className="text-lg font-semibold">Cómo está cifrado, en simple</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TechCard
              icon={KeyRound}
              title="AES-256-GCM"
              body="El mismo estándar de cifrado que usan los bancos y la NSA. Sin clave es imposible descifrar."
            />
            <TechCard
              icon={ServerCog}
              title="Aislamiento por usuario"
              body="Cada cuenta solo puede leer y escribir sus propios registros. La base de datos rechaza cualquier intento cruzado."
            />
            <TechCard
              icon={Lock}
              title="TLS 1.3 en tránsito"
              body="Todo lo que escribís viaja cifrado entre tu celular y nuestros servidores. Nadie puede leerlo en el camino."
            />
            <TechCard
              icon={EyeOff}
              title="Sin tracking de terceros"
              body="No usamos Google Analytics, Facebook Pixel ni ningún rastreador. Tu navegación dentro de la app es solo tuya."
            />
          </div>
        </section>

        {/* Verificá vos mismo */}
        <section className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Code2 className="h-5 w-5" strokeWidth={2} />
            Verificá vos mismo
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Si tenés un amigo programador o querés revisarlo vos, el código
            de cifrado está en{" "}
            <code className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">
              lib/crypto.ts
            </code>{" "}
            del repositorio. Acá está la función entera, en 8 líneas:
          </p>

          <pre className="text-xs bg-background border border-border rounded-xl p-4 overflow-x-auto font-mono leading-relaxed text-foreground/80">
{`export function encrypt(text: string): string | null {
  const key = getKey();                     // 32 bytes random
  const iv = randomBytes(12);               // nuevo cada vez
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = cipher.update(text, "utf8");
  const tag = cipher.getAuthTag();          // anti-tampering
  return "enc:" + Buffer.concat([iv, tag, body])
    .toString("base64url");
}`}
          </pre>

          <p className="text-xs text-muted leading-relaxed">
            La clave que descifra (<code className="font-mono">ENCRYPTION_KEY</code>)
            vive como variable de entorno en Vercel — nunca aparece en el código,
            nunca se commitea, nunca viaja por mail. Si alguna vez te quita la
            tranquilidad: podés{" "}
            <Link href="/configuracion" className="text-primary hover:underline">
              eliminar todos tus datos
            </Link>{" "}
            de un click.
          </p>
        </section>

        {/* Promesas */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Las 3 promesas que no rompemos</h2>
          <ol className="space-y-3 text-sm">
            {[
              "Nunca vendemos, alquilamos ni compartimos tu información financiera con terceros.",
              "No entrenamos ningún modelo de IA con tus datos.",
              "Si decidís irte, borrás tu cuenta y todo desaparece de nuestros sistemas. Sin trámites, sin emails de retención.",
            ].map((promise, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-relaxed text-foreground/90">{promise}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 pt-8">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-background font-semibold text-sm shadow-[0_4px_16px_oklch(0.67_0.19_258/35%)] hover:bg-primary-dark transition-colors"
          >
            Probar control.io
          </Link>
          <p className="text-xs text-muted">
            Cualquier duda escribime a{" "}
            <a href="mailto:control.io.oficial@gmail.com" className="text-primary hover:underline">
              control.io.oficial@gmail.com
            </a>
            . Te respondo siempre.
          </p>
        </section>

      </article>

      <footer className="border-t border-border py-6 text-center text-[10px] uppercase tracking-widest text-muted">
        control.io · Tu plata, tu control · <Link href="/privacidad" className="hover:text-foreground">Privacidad legal</Link> · <Link href="/terminos" className="hover:text-foreground">Términos</Link>
      </footer>
    </main>
  );
}

function TechCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="text-xs text-muted leading-relaxed">{body}</p>
    </div>
  );
}
