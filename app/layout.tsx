import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { MarketingTracker } from "@/components/marketing-tracker";
import { PwaRegistration } from "@/components/pwa-registration";
import { RouteNavigationIndicator } from "@/components/route-navigation-indicator";

export const metadata: Metadata = {
  title: {
    default: "Barbería LEGEND CLUB — La Paz",
    template: "%s | LEGEND CLUB",
  },
  description:
    "Barbería LEGEND CLUB en La Paz. Tradición, calle y precisión. Conoce nuestros servicios y reserva tu cita.",
  applicationName: "Barbería LEGEND CLUB",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/icon-512.png", apple: "/brand/icon-512.png" },
  other: {
    google: "notranslate",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LEGEND CLUB",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-BO" translate="no">
      <body lang="es-BO" translate="no">{children}<RouteNavigationIndicator/><PwaRegistration/><Suspense><MarketingTracker/></Suspense></body>
    </html>
  );
}
