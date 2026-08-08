import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Barbería LEGEND CLUB — La Paz",
    template: "%s | LEGEND CLUB",
  },
  description:
    "Barbería LEGEND CLUB en La Paz. Tradición, calle y precisión. Conoce nuestros servicios y reserva tu cita.",
  applicationName: "Barbería LEGEND CLUB",
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
