import { z } from "zod";
import type {
  SocialAccountReference,
  SocialContentProvider,
  SocialProviderResult,
} from "@/lib/services/social/types";

const postSchema = z.object({
  accountId: z.string().min(1).max(200),
  externalId: z.string().min(1).max(300),
  url: z.url().refine((url) => url.startsWith("https://")),
  title: z.string().min(1).max(600),
  thumbnailUrl: z
    .url()
    .refine((url) => url.startsWith("https://"))
    .nullable()
    .optional(),
  publishedAt: z.iso.datetime().nullable().optional(),
  metrics: z.record(z.string(), z.number().finite()).nullable().optional(),
  topicSignals: z.array(z.string().min(1).max(80)).max(12).optional(),
});

const responseSchema = z.object({
  posts: z.array(postSchema).max(100),
});

class RemoteSocialProvider implements SocialContentProvider {
  constructor(
    private readonly endpoint: string,
    private readonly token: string
  ) {}

  async fetchRecent(
    accounts: SocialAccountReference[]
  ): Promise<SocialProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accounts: accounts.map((account) => ({
            accountId: account.accountId,
            platform: account.platform,
            handle: account.handle,
            profileUrl: account.profileUrl,
          })),
          limitPerAccount: 4,
        }),
      });
      if (!response.ok) {
        return {
          status: "error",
          posts: [],
          reason: `El proveedor social respondió ${response.status}.`,
        };
      }

      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        return {
          status: "error",
          posts: [],
          reason: "El proveedor social devolvió datos inválidos.",
        };
      }

      return {
        status: "ok",
        posts: parsed.data.posts.map((post) => ({
          accountId: post.accountId,
          externalId: post.externalId,
          url: post.url,
          title: post.title,
          thumbnailUrl: post.thumbnailUrl ?? null,
          publishedAt: post.publishedAt ?? null,
          metrics: post.metrics ?? null,
          topicSignals: post.topicSignals ?? [],
        })),
      };
    } catch {
      return {
        status: "error",
        posts: [],
        reason: "No se pudo consultar el proveedor social a tiempo.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

class UnavailableSocialProvider implements SocialContentProvider {
  async fetchRecent(): Promise<SocialProviderResult> {
    return {
      status: "unavailable",
      posts: [],
      reason:
        "La conexión con plataformas sociales todavía no está configurada.",
    };
  }
}

export function getSocialContentProvider(): SocialContentProvider {
  const endpoint = process.env.SOCIAL_CONTENT_PROVIDER_URL?.trim();
  const token = process.env.SOCIAL_CONTENT_PROVIDER_TOKEN?.trim();
  if (!endpoint || !token || !endpoint.startsWith("https://")) {
    return new UnavailableSocialProvider();
  }
  return new RemoteSocialProvider(endpoint, token);
}
