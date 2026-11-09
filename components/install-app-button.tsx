"use client";

import { Download, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPlatform = "android" | "ios" | "desktop";

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPlatform(isIos ? "ios" : /android/i.test(userAgent) ? "android" : "desktop");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
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
  const instructions = platform === "ios"
    ? "En iPhone o iPad: pulsa Compartir en Safari y elige “Agregar a inicio”."
    : platform === "android"
      ? "En Android o Huawei: confirma “Instalar” en el diálogo. Si no aparece, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”."
      : "En Chrome, Edge, Firefox o Safari: usa el icono de instalación de la barra de direcciones o el menú del navegador.";
  return <div className={`pwa-install ${compact ? "pwa-install-compact" : ""}`}>
    <button type="button" className={compact ? "button button-small" : "button"} onClick={install}><Download size={17} /> Instalar la app</button>
    {showHelp && <div className="pwa-install-help" role="status"><strong>Instalación segura</strong><span>{instructions}</span><small>El sistema solicitará tu confirmación. No se instala nada sin tu permiso.</small>{message && <small>{message}</small>}<button type="button" onClick={() => setShowHelp(false)} aria-label="Cerrar instrucciones"><ExternalLink size={14} /> Entendido</button></div>}
  </div>;
}
