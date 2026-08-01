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
import { getChannelsBySource } from "@/lib/db/channels";
import { getFronts } from "@/lib/db/circle-north";
import { getHarvestedUrls, getHarvestReport } from "@/lib/db/circle-harvest";
import {
  getInventory,
  getMigration,
} from "@/lib/db/circle-migration";
import { northNeedsReview } from "@/lib/circle-north";
import { hasFeature } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mi Círculo" };

// "Generar ahora" puede esperar a un modelo free lento (hasta ~20s). Damos
// margen para que la server action no corte antes de tiempo.
export const maxDuration = 60;

/** El informe de La Cosecha mira los últimos 30 días. */
function hace30Dias(): Date {
  return new Date(Date.now() - 30 * 86_400_000);
}

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

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { isTester: true },
  });
  const isTester = profile?.isTester ?? false;
  const showCercanos = hasFeature("circuloCercanos", { isTester });
  const showSystem = hasFeature("circuloSistema", { isTester });

  const [editions, sources, radar, contacts] = await Promise.all([
    getEditions(user.id, 30),
    getBriefSources(user.id),
    getDailyTrendCandidates(user.id),
    showCercanos ? getCircleContacts(user.id) : Promise.resolve([]),
  ]);

  // Todo lo del sistema nuevo se carga sólo si la feature está prendida: sin
  // esto serían seis consultas de más en cada visita.
  const harvestSince = hace30Dias();
  const [channelsMap, fronts, migration, inventory, harvest, harvestedUrls] =
    showSystem
      ? await Promise.all([
          getChannelsBySource(user.id),
          getFronts(user.id),
          getMigration(user.id),
          getInventory(user.id),
          getHarvestReport(user.id, harvestSince),
          getHarvestedUrls(user.id, harvestSince),
        ])
      : [
          new Map(),
          [],
          await getMigration(user.id),
          [],
          {
            opened: 0,
            converted: 0,
            conversionRate: 0,
            byOutcome: { task: 0, habit: 0, note: 0 },
            sources: [],
            toPrune: [],
          },
          new Set<string>(),
        ];

  const needsReview =
    fronts.length > 0 &&
    northNeedsReview(
      fronts[0].reviewedAt ? new Date(fronts[0].reviewedAt) : null,
      new Date(fronts[0].createdAt),
      new Date(),
    );

  return (
    <MyCircleClient
      initialConfig={config}
      initialEditions={editions}
      initialSources={sources}
      initialRadar={radar}
      initialContacts={contacts}
      initialChannels={Object.fromEntries(channelsMap)}
      initialFronts={fronts}
      initialMigration={migration}
      initialInventory={inventory}
      initialHarvest={harvest}
      initialHarvestedUrls={[...harvestedUrls]}
      northNeedsReview={needsReview}
      showCercanos={showCercanos}
      showSystem={showSystem}
    />
  );
}
