import { describe, expect, it } from "vitest";
import {
  cleanText,
  discoverFeedUrl,
  extractYoutubeChannelId,
  isSafeHttpUrl,
  parseFeed,
  youtubeFeedUrl,
} from "@/lib/brief/feed-parser";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog de Arquitectura</title>
    <link>https://ejemplo.com</link>
    <item>
      <title><![CDATA[Cómo presupuestar una obra]]></title>
      <link>https://ejemplo.com/presupuesto</link>
      <guid isPermaLink="false">post-1</guid>
      <pubDate>Wed, 30 Jul 2026 10:00:00 GMT</pubDate>
      <description>&lt;p&gt;Una gu&#237;a corta.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Materiales que valen la pena</title>
      <link>https://ejemplo.com/materiales</link>
      <guid isPermaLink="false">post-2</guid>
      <pubDate>Tue, 29 Jul 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Canal de YouTube</title>
  <link rel="self" href="https://www.youtube.com/feeds/videos.xml?channel_id=UC123"/>
  <entry>
    <id>yt:video:abc123</id>
    <title>Cómo leo un plano</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2026-07-30T12:00:00+00:00</published>
    <media:group>
      <media:description>Explico el plano paso a paso.</media:description>
    </media:group>
  </entry>
</feed>`;

describe("parseFeed · RSS", () => {
  it("saca titulo, link, fecha y resumen", () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe("Blog de Arquitectura");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({
      externalId: "post-1",
      title: "Cómo presupuestar una obra",
      url: "https://ejemplo.com/presupuesto",
    });
    expect(feed.items[0].publishedAt?.toISOString()).toBe("2026-07-30T10:00:00.000Z");
  });

  it("limpia CDATA, HTML escapado y entidades numericas", () => {
    expect(parseFeed(RSS).items[0].summary).toBe("Una guía corta.");
  });

  it("el titulo del canal no se confunde con el de una entrada", () => {
    expect(parseFeed(RSS).title).not.toBe("Cómo presupuestar una obra");
  });
});

describe("parseFeed · Atom", () => {
  it("prefiere el link rel=alternate y no el rel=self", () => {
    const feed = parseFeed(ATOM);
    expect(feed.items[0].url).toBe("https://www.youtube.com/watch?v=abc123");
  });

  it("reconoce id, titulo y fecha de una entrada", () => {
    const item = parseFeed(ATOM).items[0];
    expect(item.externalId).toBe("yt:video:abc123");
    expect(item.title).toBe("Cómo leo un plano");
    expect(item.publishedAt?.toISOString()).toBe("2026-07-30T12:00:00.000Z");
  });
});

describe("parseFeed · basura", () => {
  it("un XML vacio no explota", () => {
    expect(parseFeed("")).toEqual({ title: null, items: [] });
    expect(parseFeed("no soy xml")).toEqual({ title: null, items: [] });
  });

  it("descarta entradas sin link o sin titulo en vez de inventarlas", () => {
    const roto = `<rss><channel>
      <item><title>Sin link</title></item>
      <item><link>https://ok.com/a</link></item>
      <item><title>Buena</title><link>https://ok.com/b</link></item>
    </channel></rss>`;
    const items = parseFeed(roto).items;
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://ok.com/b");
  });

  it("rechaza esquemas que no sean http(s)", () => {
    const malicioso = `<rss><channel><item>
      <title>Malo</title><link>javascript:alert(1)</link>
    </item></channel></rss>`;
    expect(parseFeed(malicioso).items).toHaveLength(0);
  });

  it("no repite entradas con el mismo id", () => {
    const repetido = `<rss><channel>
      <item><title>A</title><link>https://ok.com/a</link><guid>x</guid></item>
      <item><title>A otra vez</title><link>https://ok.com/a2</link><guid>x</guid></item>
    </channel></rss>`;
    expect(parseFeed(repetido).items).toHaveLength(1);
  });

  it("usa la URL como id cuando el feed no trae guid", () => {
    const sinGuid = `<rss><channel><item>
      <title>A</title><link>https://ok.com/a</link>
    </item></channel></rss>`;
    expect(parseFeed(sinGuid).items[0].externalId).toBe("https://ok.com/a");
  });

  it("una fecha ilegible queda en null, no en una fecha inventada", () => {
    const feo = `<rss><channel><item>
      <title>A</title><link>https://ok.com/a</link><pubDate>cuando sea</pubDate>
    </item></channel></rss>`;
    expect(parseFeed(feo).items[0].publishedAt).toBeNull();
  });
});

describe("discoverFeedUrl", () => {
  it("encuentra el feed declarado y lo devuelve absoluto", () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
    </head></html>`;
    expect(discoverFeedUrl(html, "https://ejemplo.com/blog")).toBe(
      "https://ejemplo.com/feed.xml",
    );
  });

  it("acepta atom ademas de rss", () => {
    const html = `<link rel="alternate" type="application/atom+xml" href="https://x.com/atom">`;
    expect(discoverFeedUrl(html, "https://x.com")).toBe("https://x.com/atom");
  });

  it("ignora links que no son feeds", () => {
    const html = `<link rel="stylesheet" href="/style.css">
      <link rel="alternate" type="text/html" href="/otra">`;
    expect(discoverFeedUrl(html, "https://x.com")).toBeNull();
  });
});

describe("YouTube", () => {
  it("saca el channelId del meta", () => {
    const html = `<meta itemprop="channelId" content="UCabcdefghijklmnopqrstuv">`;
    expect(extractYoutubeChannelId(html)).toBe("UCabcdefghijklmnopqrstuv");
  });

  it("tambien lo saca del JSON embebido", () => {
    const html = `var data = {"channelId":"UCzyxwvutsrqponmlkjihgf","otra":1}`;
    expect(extractYoutubeChannelId(html)).toBe("UCzyxwvutsrqponmlkjihgf");
  });

  // Esta es la trampa real: la pagina de un canal lista PRIMERO los canales
  // recomendados. Quedarse con el primer "channelId" devuelve un canal ajeno y
  // un feed que da 404. Reproduce el HTML de youtube.com/@Fireship.
  it("no se queda con el canal recomendado que aparece antes", () => {
    const html = `
      <link rel="canonical" href="https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA">
      <script>{"channelId":"UC2Xd-TjJByJyK2w1zNwY0zQ"}</script>
      <script>{"externalId":"UCsBjURrPoezykLs9EqgamOA"}</script>`;
    expect(extractYoutubeChannelId(html)).toBe("UCsBjURrPoezykLs9EqgamOA");
  });

  it("sin canonical, externalId le gana a channelId", () => {
    const html = `{"channelId":"UCajeno0000000000000000","externalId":"UCpropio000000000000000"}`;
    expect(extractYoutubeChannelId(html)).toBe("UCpropio000000000000000");
  });

  it("arma el feed oficial del canal", () => {
    expect(youtubeFeedUrl("UC123")).toBe(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC123",
    );
  });
});

describe("helpers", () => {
  it("isSafeHttpUrl solo deja pasar http y https", () => {
    expect(isSafeHttpUrl("https://a.com")).toBe(true);
    expect(isSafeHttpUrl("http://a.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,x")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
  });

  it("cleanText colapsa espacios y saca etiquetas", () => {
    expect(cleanText("<p>hola   <b>mundo</b></p>")).toBe("hola mundo");
  });
});
