import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getConfig, getEditions } from "@/lib/db/newsletter";
import { NewsletterClient } from "./NewsletterClient";
import { MyBriefClient } from "./MyBriefClient";

export const metadata: Metadata = { title: "Newsletter" };

const MY_BRIEF_EMAIL = "yorismatias372@gmail.com";

// "Generar ahora" puede esperar a un modelo free lento (hasta ~20s). Damos
// margen para que la server action no corte antes de tiempo.
export const maxDuration = 60;

export default async function NewsletterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [config, editions] = await Promise.all([
    getConfig(user.id),
    getEditions(user.id, 30),
  ]);

  if (user.email?.toLowerCase() === MY_BRIEF_EMAIL) {
    return <MyBriefClient initialConfig={config} initialEditions={editions} />;
  }

  return <NewsletterClient initialConfig={config} initialEditions={editions} />;
}
