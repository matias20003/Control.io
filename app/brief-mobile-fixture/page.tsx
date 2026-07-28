import { notFound } from "next/navigation";
import { MyBriefClient } from "@/app/(dashboard)/newsletter/MyBriefClient";
import type {
  SerializedConfig,
  SerializedEdition,
} from "@/lib/db/newsletter";
import type {
  SerializedBriefSource,
  SerializedDiscoveryCandidate,
} from "@/lib/brief/types";

export const dynamic = "force-dynamic";

export default function BriefMobileFixturePage() {
  if (process.env.BRIEF_E2E_FIXTURE !== "1") notFound();

  const now = new Date();
  const today = now.toISOString();
  const config: SerializedConfig = {
    topics: ["Inteligencia artificial", "Arquitectura"],
    priorityTopics: ["Arquitectura"],
    language: "es",
    country: "ar",
    isActive: true,
    sendHour: 8,
    sendHours: [8, 18],
    notifyOnReady: true,
    notifyPush: false,
    notifyWhatsapp: false,
    discoveryLevel: "BALANCED",
    briefLength: "NORMAL",
    localSourcesMigrated: true,
  };

  const editions: SerializedEdition[] = [
    {
      id: "fixture-edition-today",
      date: today,
      summary:
        "La inteligencia artificial vuelve a cruzarse con el trabajo creativo. En arquitectura, el foco está en decisiones concretas y no en tendencias pasajeras.",
      articles: [],
      isRead: false,
      completedAt: null,
      reviewedCount: 2,
      createdAt: today,
      updatedAt: today,
      items: [
        {
          id: "fixture-key",
          contentKey: "fixture-key",
          kind: "NEWS",
          sourceType: "NEWS" as const,
          sourceId: null,
          title:
            "Nuevas herramientas ayudan a revisar proyectos sin reemplazar el criterio profesional",
          summary:
            "La adopción crece en tareas repetitivas, con revisión humana como condición.",
          url: "https://example.com/noticia-clave",
          topic: "Arquitectura",
          publishedAt: today,
          rank: 1,
          section: "KEYS",
          inclusionReason: "Coincide con uno de tus temas prioritarios.",
          metadata: {
            source: "Medio verificado",
            reputable: true,
            priority: true,
          },
        },
        {
          id: "fixture-social",
          contentKey: "fixture-social",
          kind: "SOCIAL",
          sourceType: "INSTAGRAM",
          sourceId: "fixture-source",
          title: "Tres decisiones que ordenan una presentación de proyecto",
          summary:
            "Una guía breve para explicar alcance, tiempos y próximos pasos.",
          url: "https://www.instagram.com/p/fixture/",
          topic: "Arquitectura",
          publishedAt: today,
          rank: 1,
          section: "SOURCES",
          inclusionReason: "Está en tus fuentes.",
          metadata: {
            author: "Franco Pisso",
            handle: "francopisso",
            platform: "INSTAGRAM",
          },
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `fixture-topic-${index}`,
          contentKey: `fixture-topic-${index}`,
          kind: "NEWS" as const,
          sourceType: "NEWS" as const,
          sourceId: null,
          title:
            index === 0
              ? "Un titular deliberadamente largo comprueba que la lectura móvil no depende de truncados"
              : `Actualización relevante ${index + 1} para tus temas`,
          summary: "Qué pasó y por qué importa, explicado en una sola línea.",
          url: `https://example.com/noticia-${index}`,
          topic: index % 2 === 0 ? "Inteligencia artificial" : "Arquitectura",
          publishedAt: today,
          rank: index + 2,
          section: "TOPICS" as const,
          inclusionReason: "Proviene de una fuente reconocida.",
          metadata: { source: "Agencia confiable", reputable: true },
        })),
      ],
    },
  ];

  const sources: SerializedBriefSource[] = [
    {
      id: "fixture-source",
      name: "Franco Pisso",
      sourceType: "PERSON",
      category: "REFERENCE",
      priority: true,
      isActive: true,
      createdAt: today,
      updatedAt: today,
      account: {
        id: "fixture-account",
        platform: "INSTAGRAM",
        handle: "francopisso",
        profileUrl: "https://www.instagram.com/francopisso/",
        status: "ACTIVE",
        lastSyncedAt: today,
      },
    },
  ];

  const radar: SerializedDiscoveryCandidate[] = [
    {
      id: "fixture-radar",
      candidateType: "ACCOUNT",
      sourceName: "Estudio Abierto",
      platform: "YOUTUBE",
      handle: "estudioabierto",
      profileUrl: "https://www.youtube.com/@estudioabierto",
      topic: "Arquitectura",
      explanation:
        "Coincide con dos de tus temas y fue citado por una fuente que ya seguís.",
      signals: { affinity: "high", citations: 2 },
      status: "PENDING",
      date: today,
    },
  ];

  return (
    <MyBriefClient
      initialConfig={config}
      initialEditions={editions}
      initialSources={sources}
      initialRadar={radar}
    />
  );
}
