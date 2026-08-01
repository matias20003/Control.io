// Prueba de humo contra feeds reales. Apagada por defecto porque sale a la red
// y sería flaky en CI. Para correrla:
//   SMOKE_CHANNELS=1 npx vitest run tests/smoke-channels.test.ts --silent=false
import { describe, expect, it } from "vitest";
import { fetchChannelItems, resolveChannel } from "@/lib/services/brief/channels";

const CASOS = [
  { nombre: "YouTube (@handle)", url: "https://www.youtube.com/@Fireship" },
  { nombre: "Substack", url: "https://astralcodexten.substack.com" },
  { nombre: "Blog con RSS declarado", url: "https://overreacted.io" },
  { nombre: "Feed directo", url: "https://news.ycombinator.com/rss" },
  { nombre: "Instagram (huérfano esperado)", url: "https://instagram.com/alguien" },
  { nombre: "Sitio sin feed", url: "https://example.com" },
];

describe.skipIf(!process.env.SMOKE_CHANNELS)("resolveChannel contra la red real", () => {
  for (const caso of CASOS) {
    it(
      caso.nombre,
      async () => {
        const resultado = await resolveChannel(caso.url);
        if (resultado.ok) {
          const items = await fetchChannelItems(resultado.channel.feedUrl, 3);
          console.log(
            `✔ ${caso.nombre}\n   kind=${resultado.channel.kind}\n   feed=${resultado.channel.feedUrl}\n   titulo=${resultado.channel.title}\n   items=${items.ok ? items.items.length : "ERROR " + items.error}\n   primero=${items.ok ? items.items[0]?.title : "-"}`,
          );
        } else {
          console.log(
            `✖ ${caso.nombre}\n   orphan=${resultado.orphan}\n   motivo=${resultado.reason}`,
          );
        }
        expect(resultado).toBeDefined();
      },
      30000,
    );
  }
});
