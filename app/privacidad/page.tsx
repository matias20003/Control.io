import type { Metadata } from "next";
import Link from "next/link";
import { LogoFull } from "@/components/layout/Logo";

export const metadata: Metadata = {
  title: "Política de Privacidad — control.io",
  description: "Política de privacidad de control.io",
};

export default function PrivacidadPage() {
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
          <h1 className="text-3xl font-bold text-foreground">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-muted">Última actualización: junio de 2026</p>
        </div>

        <Section title="1. Información que recopilamos">
          Recopilamos la información que vos mismo ingresás al usar control.io:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted">
            <li>Dirección de correo electrónico (para crear tu cuenta)</li>
            <li>Datos financieros personales: movimientos, cuentas, presupuestos, metas e inversiones</li>
            <li>Si usás el <strong className="text-foreground">asistente de WhatsApp</strong>: los mensajes que le enviás (texto, audios transcriptos a texto e imágenes) y sus respuestas, para registrar tus movimientos y mantener el contexto de la conversación</li>
            <li>Preferencias de la aplicación y configuración de notificaciones</li>
          </ul>
          No recopilamos información de pago ni datos bancarios directos.
        </Section>

        <Section title="2. Cómo usamos tu información">
          Usamos tus datos exclusivamente para:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted">
            <li>Proveer y mejorar el servicio de control.io</li>
            <li>Enviarte reportes y notificaciones que vos mismo habilitás</li>
            <li>Detectar y prevenir fraudes o usos indebidos</li>
            <li>Responder a tus consultas de soporte</li>
          </ul>
          Nunca usamos tus datos financieros para publicidad ni los vendemos a terceros.
        </Section>

        <Section title="3. Almacenamiento y seguridad">
          Tus datos se almacenan en servidores seguros con cifrado en tránsito (TLS) y en reposo
          (AES-256). Aplicamos controles de acceso estrictos: solo vos podés ver tu información.
          Aunque tomamos medidas razonables para proteger tus datos, ningún sistema es 100% seguro.
          Te recomendamos usar una contraseña fuerte y única para tu cuenta.
        </Section>

        <Section title="4. Compartición de datos">
          No vendemos ni alquilamos tu información personal. La compartimos solo con proveedores
          que la procesan para que el servicio funcione, sujetos a sus propios términos:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted">
            <li><strong className="text-foreground">Vercel</strong> — alojamiento de la aplicación</li>
            <li><strong className="text-foreground">Supabase</strong> — base de datos y autenticación</li>
            <li><strong className="text-foreground">Kapso / WhatsApp (Meta)</strong> — envío y recepción de los mensajes del asistente</li>
            <li><strong className="text-foreground">OpenRouter / OpenAI</strong> — interpretación de los mensajes del asistente con IA</li>
            <li><strong className="text-foreground">PostHog y Vercel</strong> — analítica de uso para mejorar el producto (lo que escribís va enmascarado)</li>
            <li><strong className="text-foreground">Resend</strong> — envío de emails (reportes/avisos)</li>
            <li><strong className="text-foreground">Requerimiento legal</strong> si una autoridad competente lo solicita mediante orden judicial</li>
          </ul>
        </Section>

        <Section title="5. Cookies y analítica">
          control.io utiliza cookies de sesión necesarias para mantener tu inicio de sesión. Para
          entender cómo se usa la app y mejorarla, usamos analítica de producto (PostHog) y de
          rendimiento (Vercel): registran páginas visitadas, clicks y, opcionalmente, grabaciones de
          sesión con <strong className="text-foreground">los datos que escribís enmascarados</strong>.
          No usamos esta información para publicidad, no la vendemos ni integramos píxeles de redes
          publicitarias (Meta Pixel, etc.).
        </Section>

        <Section title="6. Asistente de WhatsApp">
          Si vinculás tu número, los mensajes que le envíes al asistente se procesan para registrar
          tus movimientos y responder tus consultas. Las conversaciones se guardan{" "}
          <strong className="text-foreground">encriptadas (AES-256)</strong> y solo se conserva el
          historial reciente para mantener el contexto. Podés desvincular tu número cuando quieras
          desde Configuración → Perfil.
        </Section>

        <Section title="7. Retención de datos">
          Conservamos tu información mientras tu cuenta esté activa. Si cancelás tu cuenta,
          eliminamos tus datos personales dentro de los 30 días siguientes, excepto aquellos
          que debamos conservar por obligación legal.
        </Section>

        <Section title="8. Tus derechos">
          Como usuario de control.io tenés derecho a:
          <ul className="mt-3 space-y-1.5 list-disc list-inside text-muted">
            <li><strong className="text-foreground">Acceder</strong> a todos los datos que tenemos sobre vos</li>
            <li><strong className="text-foreground">Rectificar</strong> información incorrecta</li>
            <li><strong className="text-foreground">Exportar</strong> tus datos en formato legible</li>
            <li><strong className="text-foreground">Eliminar</strong> tu cuenta y todos tus datos</li>
            <li><strong className="text-foreground">Revocar</strong> el consentimiento de notificaciones en cualquier momento</li>
          </ul>
          Para ejercer cualquiera de estos derechos, escribinos a{" "}
          <a href="mailto:control.io.oficial@gmail.com" className="text-primary hover:underline">
            control.io.oficial@gmail.com
          </a>.
        </Section>

        <Section title="9. Menores de edad">
          control.io no está dirigido a menores de 18 años. Si tomamos conocimiento de que hemos
          recopilado datos de un menor, los eliminaremos de inmediato.
        </Section>

        <Section title="10. Cambios a esta política">
          Podemos actualizar esta política en cualquier momento. Si los cambios son significativos,
          te lo comunicaremos por correo electrónico o mediante un aviso en la aplicación.
          La fecha de última actualización siempre estará visible al inicio de esta página.
        </Section>

        <Section title="11. Contacto">
          Para consultas sobre privacidad o protección de datos:
          <div className="mt-2">
            <a href="mailto:control.io.oficial@gmail.com" className="text-primary hover:underline">
              control.io.oficial@gmail.com
            </a>
          </div>
        </Section>

        <div className="pt-4 border-t border-border flex flex-wrap gap-4 text-sm text-muted">
          <Link href="/terminos" className="hover:text-primary transition-colors">Términos y Condiciones</Link>
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
