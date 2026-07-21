import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoFull } from "@/components/layout/Logo";
import { ChevronLeft } from "lucide-react";
import { CorreosClient } from "./CorreosClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correos — control.io" };

export default async function CorreosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const configured = !!(process.env.GMAIL_IMAP_USER && process.env.GMAIL_IMAP_PASSWORD);
  const account = process.env.GMAIL_IMAP_USER ?? "";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface/60 backdrop-blur px-4 md:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted hover:text-foreground transition-colors" aria-label="Volver al admin">
            <ChevronLeft size={20} />
          </Link>
          <LogoFull size="xs" />
          <span className="text-sm font-semibold text-muted">· Correos</span>
        </div>
        {account && <span className="text-xs text-muted hidden sm:block">{account}</span>}
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        {configured ? (
          <CorreosClient />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-2 mt-6">
            <p className="text-lg font-bold text-foreground">Falta conectar la casilla</p>
            <p className="text-sm text-muted max-w-md mx-auto">
              Seteá <code className="text-foreground">GMAIL_IMAP_USER</code> y{" "}
              <code className="text-foreground">GMAIL_IMAP_PASSWORD</code> (App Password de Gmail) en las
              variables de entorno de Vercel y recargá.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
