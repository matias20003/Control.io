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

  const channel = {
    id: "channel-item-1",
    contentKey: "channel-item-1",
    kind: "CHANNEL" as const,
    sourceType: "YOUTUBE" as const,
    sourceId: "source-1",
    title: "Cómo diseñar ciudades que devuelvan tiempo",
    summary:
      "Una conversación sobre arquitectura, atención y decisiones que reducen fricción cotidiana.",
    url: "https://example.com/referente",
    topic: "Arquitectura",
    publishedAt: now,
    rank: 1,
    section: "SOURCES" as const,
    inclusionReason: "Aporta a tu frente Arquitecto con criterio.",
    metadata: { source: "Franco Pisso", channelKind: "YOUTUBE" },
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
      items: [social, channel, ...news],
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
    {
      id: "source-2",
      name: "Lina Khan",
      sourceType: "PERSON",
      category: "REFERENCE",
      priority: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      account: {
        id: "account-2",
        platform: "INSTAGRAM",
        handle: "linamkhan",
        profileUrl: "https://www.instagram.com/linamkhan/",
        status: "ACTIVE",
        lastSyncedAt: null,
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
      initialContacts={[
        {
          id: "contact-1",
          name: "Mateo",
          phone: "5491155550101",
          note: "Preguntarle cómo salió la entrega.",
          tier: "CLOSE",
          cadenceDays: 28,
          lastContactAt: "2026-06-27T12:00:00.000Z",
          createdAt: "2026-04-03T12:00:00.000Z",
          daysSince: 35,
          overdueDays: 7,
          isDue: true,
          neverContacted: false,
        },
        {
          id: "contact-2",
          name: "Sofi",
          phone: "5491155550102",
          note: "Contarle lo de Control.io.",
          tier: "INTIMATE",
          cadenceDays: 14,
          lastContactAt: "2026-07-15T12:00:00.000Z",
          createdAt: "2026-05-03T12:00:00.000Z",
          daysSince: 17,
          overdueDays: 3,
          isDue: true,
          neverContacted: false,
        },
        {
          id: "contact-3",
          name: "Juli",
          phone: null,
          note: null,
          tier: "ORBIT",
          cadenceDays: 84,
          lastContactAt: "2026-07-20T12:00:00.000Z",
          createdAt: "2026-02-02T12:00:00.000Z",
          daysSince: 12,
          overdueDays: -72,
          isDue: false,
          neverContacted: false,
        },
      ]}
      initialChannels={{
        "source-1": [
          {
            id: "channel-1",
            sourceId: "source-1",
            kind: "YOUTUBE",
            siteUrl: "https://www.youtube.com/@francopisso",
            feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=fixture",
            title: "Franco Pisso",
            status: "ACTIVE",
            lastError: null,
            lastFetchedAt: now,
          },
        ],
      }}
      initialFronts={[
        {
          id: "front-1",
          label: "Arquitecto con criterio",
          detail: "Tomar mejores decisiones de diseño y explicar por qué.",
          topics: ["arquitectura", "diseño urbano", "materiales"],
          position: 0,
          reviewedAt: now,
          createdAt: "2026-06-22T12:00:00.000Z",
        },
        {
          id: "front-2",
          label: "Constructor de productos",
          detail: "Convertir problemas reales en software simple.",
          topics: ["inteligencia artificial", "producto digital", "SaaS"],
          position: 1,
          reviewedAt: now,
          createdAt: "2026-06-22T12:00:00.000Z",
        },
      ]}
      initialMigration={{
        stage: "INVENTORY",
        inventoryUploadedAt: null,
        coexistStartedAt: null,
        uninstalledAt: null,
        reinstalledAt: null,
        daysWithout: null,
        coexistDays: null,
      }}
      initialInventory={[
        {
          id: "inventory-1",
          handle: "amigo.real",
          fullName: "Amigo Real",
          decision: "PENDING",
          resolvedType: null,
          resolvedId: null,
        },
        {
          id: "inventory-2",
          handle: "referente.util",
          fullName: "Referente Útil",
          decision: "REFERENCE",
          resolvedType: "SOURCE",
          resolvedId: "source-1",
        },
        {
          id: "inventory-3",
          handle: "ruido.diario",
          fullName: null,
          decision: "NOISE",
          resolvedType: null,
          resolvedId: null,
        },
      ]}
      initialHarvest={{
        opened: 12,
        converted: 4,
        conversionRate: 33,
        byOutcome: { task: 2, habit: 1, note: 1 },
        sources: [
          {
            sourceId: "source-1",
            name: "Franco Pisso",
            conversions: 4,
            lastConversionAt: now,
            daysSinceLastConversion: 0,
            suggestPruning: false,
          },
          {
            sourceId: "source-2",
            name: "Lina Khan",
            conversions: 0,
            lastConversionAt: null,
            daysSinceLastConversion: null,
            suggestPruning: true,
          },
        ],
        toPrune: [
          {
            sourceId: "source-2",
            name: "Lina Khan",
            conversions: 0,
            lastConversionAt: null,
            daysSinceLastConversion: null,
            suggestPruning: true,
          },
        ],
      }}
      initialHarvestedUrls={["https://example.com/economia"]}
      northNeedsReview={false}
      showCercanos
      showSystem
      // La capa de recompensa, con material realista: alguien que ya se miró al
      // espejo, tiene historia y todavía está dentro del andamio.
      baseline={{
        followedAtStart: 412,
        capturedAt: "2026-06-22T12:00:00.000Z",
        people: 11,
        references: 14,
        noise: 386,
        pending: 1,
      }}
      lifetime={{
        converted: 12,
        byOutcome: { task: 6, habit: 3, note: 3 },
        firstAt: "2026-06-24T12:00:00.000Z",
        habitsAlive: 2,
        tasksDone: 4,
      }}
      conversations={9}
      conversationsWithMemory={4}
      actDates={[
        "2026-07-28T12:00:00.000Z",
        "2026-07-29T12:00:00.000Z",
        "2026-07-30T12:00:00.000Z",
        "2026-07-21T12:00:00.000Z",
        "2026-07-22T12:00:00.000Z",
        "2026-07-23T12:00:00.000Z",
      ]}
      dose={{
        phase: "ANDAMIO",
        monthsIn: 1,
        intensity: 100,
        fullCelebration: true,
        showStreak: true,
        announce: true,
        mirrorFirst: false,
      }}
    />
  );
}
