import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barbería LEGEND CLUB",
    short_name: "LEGEND CLUB",
    id: "/panel",
    description: "Servicios, galería, productos y reservas de Barbería LEGEND CLUB.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#efe2c4",
    theme_color: "#efe2c4",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
