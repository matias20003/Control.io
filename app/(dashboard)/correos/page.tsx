import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CorreosClient } from "./CorreosClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Correos" };

// Bandeja unificada — SOLO para el dueño (gate por ADMIN_EMAIL). Vive dentro del
// menú de la app (no en /admin) pero no aparece ni es accesible para el resto.
export default async function CorreosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  const configured = !!(process.env.GMAIL_IMAP_USER && process.env.GMAIL_IMAP_PASSWORD);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
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
    </div>
  );
}
