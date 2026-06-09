import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "control.io — Finanzas Personales",
    short_name: "control.io",
    description: "Tu sistema de finanzas personales",
    start_url: "/dashboard",
    display: "standalone",
    // Mismo azul que el splash in-app → la pantalla nativa (estática) empalma
    // sin cortes con nuestra animación de lanzamiento.
    background_color: "#2563EB",
    theme_color: "#2563EB",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
