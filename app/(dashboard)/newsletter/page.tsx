import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getConfig, getEditions } from "@/lib/db/newsletter";
import { MyBriefClient } from "./MyBriefClient";
import { getBriefSources, getDiscoveryCandidates } from "@/lib/db/brief";
import { ensureRadarForUser } from "@/lib/services/brief/radar";

export const metadata: Metadata = { title: "Mi Brief" };

// "Generar ahora" puede esperar a un modelo free lento (hasta ~20s). Damos
// margen para que la server action no corte antes de tiempo.
export const maxDuration = 60;

export default async function NewsletterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await getConfig(user.id);
  await ensureRadarForUser(user.id, {
    level: config.discoveryLevel,
    topics: config.topics,
    priorityTopics: config.priorityTopics,
    language: config.language,
    country: config.country,
  }).catch(() => {
    // Radar es secundario: una fuente externa nunca bloquea la lectura del Brief.
  });
  const [editions, sources, radar] = await Promise.all([
    getEditions(user.id, 30),
    getBriefSources(user.id),
    getDiscoveryCandidates(user.id, config.discoveryLevel),
  ]);

  return (
    <MyBriefClient
      initialConfig={config}
      initialEditions={editions}
      initialSources={sources}
      initialRadar={radar}
    />
  );
}
