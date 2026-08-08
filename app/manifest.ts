import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Navaja Peluquería & Barbería",
    short_name: "Navaja",
    description: "Servicios, galería y reservas de Navaja.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f0e8",
    theme_color: "#171814",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
