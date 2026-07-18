import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getConfig, getEditions } from "@/lib/db/newsletter";
import { NewsletterClient } from "./NewsletterClient";

export const metadata: Metadata = { title: "Newsletter" };

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

  return <NewsletterClient initialConfig={config} initialEditions={editions} />;
}
