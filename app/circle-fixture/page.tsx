import { notFound } from "next/navigation";
import { MyCircleClient } from "@/app/(dashboard)/newsletter/MyCircleClient";
import type {
  SerializedConfig,
  SerializedEdition,
} from "@/lib/db/newsletter";
import type {
  SerializedBriefSource,
  SerializedDiscoveryCandidate,
} from "@/lib/brief/types";

export const dynamic = "force-dynamic";

export default function CircleFixturePage() {
  if (process.env.BRIEF_E2E_FIXTURE !== "1") notFound();

  const now = new Date().toISOString();
  const config: SerializedConfig = {
    topics: ["Inteligencia artificial", "Economía", "Arquitectura"],
    priorityTopics: ["Inteligencia artificial"],
    language: "es",
    country: "ar",
    isActive: true,
    sendHour: new Date().getHours(),
    sendHours: [new Date().getHours(), 19].filter(
      (hour, index, values) => values.indexOf(hour) === index
    ),
    notifyOnReady: true,
    notifyPush: false,
    notifyWhatsapp: true,
    discoveryLevel: "EXPLORER",
    briefLength: "NORMAL",
    localSourcesMigrated: true,
  };

  const news = [
    {
      id: "news-1",
      contentKey: "news-1",
      kind: "NEWS" as const,
      sourceType: "NEWS" as const,
      sourceId: null,
      title: "Nuevas reglas buscan dar más transparencia al uso de IA",
      summary:
        "El marco propone informar cuándo una decisión automatizada puede afectar a una persona.",
      url: "https://example.com/ia",
      topic: "Inteligencia artificial",
      publishedAt: now,
      rank: 1,
      section: "KEYS" as const,
      inclusionReason: "Coincide con uno de tus temas prioritarios.",
      metadata: { source: "Reuters", reputable: true },
    },
    {
      id: "news-2",
      contentKey: "news-2",
      kind: "NEWS" as const,
      sourceType: "NEWS" as const,
      sourceId: null,
      title: "La inflación mensual desacelera por segundo período consecutivo",
      summary:
        "La baja estuvo explicada principalmente por alimentos y transporte.",
      url: "https://example.com/economia",
      topic: "Economía",
      publishedAt: now,
      rank: 1,
      section: "TOPICS" as const,
      inclusionReason: "Fue confirmada por más de una fuente.",
      metadata: { source: "Infobae", reputable: true },
    },
    {
      id: "news-3",
      contentKey: "news-3",
      kind: "NEWS" as const,
      sourceType: "NEWS" as const,
      sourceId: null,
      title: "Materiales de bajo impacto ganan lugar en proyectos urbanos",
      summary:
        "Estudios regionales están incorporando nuevos criterios de trazabilidad.",
      url: "https://example.com/arquitectura",
      topic: "Arquitectura",
      publishedAt: now,
      rank: 1,
      section: "TOPICS" as const,
      inclusionReason: "Apareció en medios especializados reconocidos.",
      metadata: { source: "ArchDaily", reputable: true },
    },
  ];

  const social = {
    id: "social-1",
    contentKey: "social-1",
    kind: "SOCIAL" as const,
    sourceType: "INSTAGRAM" as const,
    sourceId: "source-1",
    title: "Publicó una historia",
    summary: "Nueva actividad desde la última revisión.",
    url: "https://www.instagram.com/francopisso/",
    topic: "Arquitectura",
    publishedAt: now,
    rank: 1,
    section: "SOURCES" as const,
    inclusionReason: "Forma parte de tu círculo.",
    metadata: { handle: "francopisso", author: "Franco Pisso" },
  };

  const editions: SerializedEdition[] = [
    {
      id: "circle-today",
      date: now,
      summary: "Tres señales importantes para empezar el día con contexto.",
      articles: [],
      isRead: false,
      completedAt: null,
      reviewedCount: 1,
      createdAt: now,
      updatedAt: now,
      items: [social, ...news],
    },
  ];

  const sources: SerializedBriefSource[] = [
    {
      id: "source-1",
      name: "Franco Pisso",
      sourceType: "PERSON",
      category: "REFERENCE",
      priority: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      account: {
        id: "account-1",
        platform: "INSTAGRAM",
        handle: "francopisso",
        profileUrl: "https://www.instagram.com/francopisso/",
        status: "ACTIVE",
        lastSyncedAt: now,
      },
    },
  ];

  const radar: SerializedDiscoveryCandidate[] = [
    ["Inteligencia artificial", "Reuters", 8],
    ["Economía", "Bloomberg", 5],
    ["Arquitectura sostenible", "ArchDaily", 3],
  ].map(([topic, source, citations], index) => ({
    id: `radar-${index}`,
    candidateType: "MEDIA",
    sourceName: String(source),
    platform: "WEB",
    handle: null,
    profileUrl: `https://example.com/radar-${index}`,
    topic: String(topic),
    explanation: `${topic} aparece en varias fuentes confiables y se relaciona con tus temas elegidos.`,
    signals: { citations: Number(citations), reputable: true },
    status: "PENDING",
    date: now,
  }));

  return (
    <MyCircleClient
      initialConfig={config}
      initialEditions={editions}
      initialSources={sources}
      initialRadar={radar}
      initialContacts={[]}
      showCercanos={false}
    />
  );
}
