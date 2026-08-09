import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { MarketingTracker } from "@/components/marketing-tracker";
import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: {
    default: "Barbería LEGEND CLUB — La Paz",
    template: "%s | LEGEND CLUB",
  },
  description:
    "Barbería LEGEND CLUB en La Paz. Tradición, calle y precisión. Conoce nuestros servicios y reserva tu cita.",
  applicationName: "Barbería LEGEND CLUB",
  manifest: "/manifest.webmanifest",
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#171814",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-BO" translate="no">
      <body lang="es-BO" translate="no">{children}<PwaRegistration/><Suspense><MarketingTracker/></Suspense></body>
    </html>
  );
}
