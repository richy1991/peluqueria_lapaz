import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Navaja — Peluquería & Barbería",
    template: "%s | Navaja",
  },
  description:
    "Cortes, barba y estilo en el centro de La Paz. Conoce nuestros servicios y reserva tu cita en línea.",
  applicationName: "Navaja",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#171814",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
