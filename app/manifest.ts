import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barbería LEGEND CLUB",
    short_name: "LEGEND CLUB",
    description: "Servicios, galería, productos y reservas de Barbería LEGEND CLUB.",
    start_url: "/",
    display: "standalone",
    background_color: "#efe2c4",
    theme_color: "#0c0b09",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
