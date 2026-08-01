import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getConfig, getEditions } from "@/lib/db/newsletter";
import { MyCircleClient } from "./MyCircleClient";
import {
  getBriefSources,
  getDailyTrendCandidates,
} from "@/lib/db/brief";
import { ensureDailyTrendsForUser } from "@/lib/services/brief/radar";
import { getCircleContacts } from "@/lib/db/circle";
import { hasFeature } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mi Círculo" };

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
  await ensureDailyTrendsForUser(user.id, {
    language: config.language,
    country: config.country,
  }).catch(() => {
    // Radar es secundario: una fuente externa nunca bloquea la lectura del Brief.
  });
  const [editions, sources, radar, profile, contacts] = await Promise.all([
    getEditions(user.id, 30),
    getBriefSources(user.id),
    getDailyTrendCandidates(user.id),
    prisma.profile.findUnique({ where: { id: user.id }, select: { isTester: true } }),
    getCircleContacts(user.id),
  ]);

  const showCercanos = hasFeature("circuloCercanos", {
    isTester: profile?.isTester ?? false,
  });

  return (
    <MyCircleClient
      initialConfig={config}
      initialEditions={editions}
      initialSources={sources}
      initialRadar={radar}
      initialContacts={showCercanos ? contacts : []}
      showCercanos={showCercanos}
    />
  );
}
