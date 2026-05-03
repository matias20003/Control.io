import type { Metadata } from "next";
import Link from "next/link";
import { LogoFull } from "@/components/layout/Logo";

export const metadata: Metadata = {
  title: "Términos y Condiciones — control.io",
  description: "Términos y condiciones de uso de control.io",
};

export default function TerminosPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav mínima */}
      <header className="border-b border-border px-6 py-4">
        <Link href="/">
          <LogoFull size="xs" />
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Términos y Condiciones</h1>
          <p className="mt-2 text-sm text-muted">Última actualización: mayo de 2025</p>
        </div>

        <Section title="1. Aceptación de los términos">
          Al acceder y utilizar control.io, aceptás estos Términos y Condiciones en su totalidad.
          Si no estás de acuerdo con alguna parte, no debés usar el servicio.
        </Section>

        <Section title="2. Descripción del servicio">
          control.io es una plataforma de gestión de finanzas personales que permite a los usuarios
          registrar movimientos, cuentas, inversiones, deudas, metas y presupuestos. El servicio
          se provee tal cual está disponible, sin garantías de disponibilidad ininterrumpida.
        </Section>

        <Section title="3. Registro y cuenta">
          Para usar control.io necesitás crear una cuenta con un email válido y una contraseña segura.
          Sos responsable de mantener la confidencialidad de tus credenciales y de toda actividad
          que ocurra bajo tu cuenta. Debés notificarnos inmediatamente ante cualquier uso no autorizado.
        </Section>

        <Section title="4. Uso aceptable">
          Te comprometés a no usar control.io para:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted">
            <li>Actividades ilegales o fraudulentas</li>
            <li>Intentar acceder a datos de otros usuarios</li>
            <li>Sobrecargar o atacar la infraestructura del servicio</li>
            <li>Distribuir malware o código malicioso</li>
            <li>Cualquier uso que viole la legislación argentina vigente</li>
          </ul>
        </Section>

        <Section title="5. Datos financieros">
          Los datos que ingresás en control.io (movimientos, saldos, inversiones, etc.) son de tu
          exclusiva propiedad. No los compartimos con terceros ni los usamos para fines publicitarios.
          Sos el único responsable de la exactitud de la información que registrás.
        </Section>

        <Section title="6. Limitación de responsabilidad">
          control.io es una herramienta de registro y organización personal. No somos una entidad
          financiera, no brindamos asesoramiento financiero, ni somos responsables de decisiones
          económicas tomadas en base a la información registrada en la plataforma. En ningún caso
          nuestra responsabilidad excederá el monto abonado por el servicio en los últimos 30 días.
        </Section>

        <Section title="7. Disponibilidad del servicio">
          Nos esforzamos por mantener el servicio disponible, pero no garantizamos disponibilidad
          del 100%. Podemos realizar mantenimientos, actualizaciones o interrupciones sin previo aviso.
          No somos responsables por pérdidas derivadas de interrupciones del servicio.
        </Section>

        <Section title="8. Modificaciones">
          Podemos modificar estos términos en cualquier momento. Los cambios entran en vigencia
          al ser publicados en esta página. El uso continuado del servicio implica la aceptación
          de los términos modificados.
        </Section>

        <Section title="9. Cancelación">
          Podés cancelar tu cuenta en cualquier momento desde la sección de Configuración.
          Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.
        </Section>

        <Section title="10. Ley aplicable">
          Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa
          se someterá a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma
          de Buenos Aires.
        </Section>

        <Section title="11. Contacto">
          Para consultas sobre estos términos:
          <div className="mt-2">
            <a href="mailto:control.io.oficial@gmail.com" className="text-primary hover:underline">
              control.io.oficial@gmail.com
            </a>
          </div>
        </Section>

        <div className="pt-4 border-t border-border flex flex-wrap gap-4 text-sm text-muted">
          <Link href="/privacidad" className="hover:text-primary transition-colors">Política de Privacidad</Link>
          <Link href="/" className="hover:text-primary transition-colors">Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted leading-relaxed">{children}</div>
    </section>
  );
}
