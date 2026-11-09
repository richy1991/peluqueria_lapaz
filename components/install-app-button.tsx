"use client";

import { Download, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPlatform = "android" | "ios" | "desktop";

function getInstallContext() {
  if (typeof navigator === "undefined") {
    return { platform: "desktop" as const, iosBrowser: "safari" as const, isXiaomi: false, installed: false };
  }
  const userAgent = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    platform: (isIos ? "ios" : /android/i.test(userAgent) ? "android" : "desktop") as InstallPlatform,
    iosBrowser: (isIos && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent) ? "safari" : "other") as "safari" | "other",
    isXiaomi: /xiaomi|redmi|miui/i.test(userAgent),
    installed: typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
  };
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const installContext = getInstallContext();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(installContext.installed);
  const [showHelp, setShowHelp] = useState(false);
  const [platform] = useState<InstallPlatform>(installContext.platform);
  const [iosBrowser] = useState<"safari" | "other">(installContext.iosBrowser);
  const [isXiaomi] = useState(installContext.isXiaomi);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setShowHelp(true);
      return;
    }
    setMessage("");
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setMessage("El navegador no pudo abrir el diálogo. Usa las instrucciones de instalación.");
      setShowHelp(true);
    } finally {
      setInstallEvent(null);
    }
  }

  if (installed) return <span className="pwa-installed"><Smartphone size={16} /> App instalada</span>;
  let instructions = "En Chrome, Edge, Firefox o Safari: usa el icono de instalación de la barra de direcciones o el menú del navegador.";
  if (platform === "ios") {
    instructions = iosBrowser === "safari"
      ? "En iPhone o iPad: pulsa Compartir en Safari y elige “Agregar a inicio”."
      : "iOS solo permite instalar desde Safari. Copia esta dirección, ábrela en Safari y pulsa Compartir → Agregar a inicio.";
  } else if (platform === "android") {
    instructions = isXiaomi
      ? "En Redmi/Xiaomi: confirma “Instalar” si aparece. Si no aparece, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”. En Mi Browser puede aparecer como “Añadir a pantalla de inicio”."
      : "En Android o Huawei: confirma “Instalar” en el diálogo. Si no aparece, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”.";
  }
  return <div className={`pwa-install ${compact ? "pwa-install-compact" : ""}`}>
    <button type="button" className={compact ? "button button-small" : "button"} onClick={install}><Download size={17} /> Instalar la app</button>
    {showHelp && <div className="pwa-install-help" role="status"><strong>Instalación segura</strong><span>{instructions}</span><small>El sistema solicitará tu confirmación. No se instala nada sin tu permiso.</small>{message && <small>{message}</small>}<button type="button" onClick={() => setShowHelp(false)} aria-label="Cerrar instrucciones"><ExternalLink size={14} /> Entendido</button></div>}
  </div>;
}
