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
      // SVG escalable primero (Chrome lo prefiere; nítido a cualquier tamaño).
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      // PNG para navegadores/SO que no aceptan SVG en el install prompt.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: el SO recorta a círculo/squircle; la "c" va en zona segura.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
