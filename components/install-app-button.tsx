"use client";

import { Download, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const ANDROID_APK_URL = "https://github.com/richy1991/peluqueria_lapaz/releases/latest/download/legend-club-android.apk";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallContext = {
  platform: "android" | "ios" | "desktop";
  iosBrowser: "safari" | "other";
  isXiaomi: boolean;
  installed: boolean;
};

const defaultInstallContext: InstallContext = {
  platform: "desktop",
  iosBrowser: "safari",
  isXiaomi: false,
  installed: false,
};

const subscribeToHydration = () => () => {};

function getInstallContext(): InstallContext {
  const userAgent = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    platform: isIos ? "ios" : /android/i.test(userAgent) ? "android" : "desktop",
    iosBrowser: isIos && /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent) ? "safari" : "other",
    isXiaomi: /xiaomi|redmi|miui/i.test(userAgent),
    installed: window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  };
}

export function InstallAppButton({ compact = false, androidApk = false }: { compact?: boolean; androidApk?: boolean }) {
  // Keep the first browser render in sync with the server before reading the platform.
  const canReadBrowser = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const { platform, iosBrowser, isXiaomi, installed } = canReadBrowser ? getInstallContext() : defaultInstallContext;
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installedInSession, setInstalledInSession] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalledInSession(true);
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
      if (choice.outcome === "accepted") setInstalledInSession(true);
    } catch {
      setMessage("El navegador no pudo abrir el diálogo. Usa las instrucciones de instalación.");
      setShowHelp(true);
    } finally {
      setInstallEvent(null);
    }
  }

  if ((installed || installedInSession) && !(androidApk && platform === "android")) return <span className="pwa-installed"><Smartphone size={16} /> App instalada</span>;
  let instructions = "En Chrome, Edge, Firefox o Safari: usa el icono de instalación de la barra de direcciones o el menú del navegador.";
  if (platform === "ios") {
    instructions = iosBrowser === "safari"
      ? "En iPhone o iPad: pulsa Compartir en Safari y elige “Agregar a pantalla de inicio”."
      : "En iOS, abre esta página en Safari, pulsa Compartir y elige “Agregar a pantalla de inicio”.";
  } else if (platform === "android") {
    instructions = isXiaomi
      ? "En Redmi o Xiaomi: confirma “Instalar” si aparece. Si no aparece, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”."
      : "En Android o Huawei: abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”.";
  }

  if (androidApk && platform === "android") return <div className={`pwa-install ${compact ? "pwa-install-compact" : ""}`}>
    <a className={compact ? "button button-small" : "button"} href={ANDROID_APK_URL}>
      <Download size={17} /> Descargar APK
    </a>
    <button type="button" className="pwa-install-web" onClick={() => void install()}>
      <Smartphone size={14} /> Instalar versión web
    </button>
    {showHelp && <div className="pwa-install-help" role="status">
      <strong>Instalar la versión web</strong><span>{instructions}</span>{message && <small>{message}</small>}
      <button type="button" onClick={() => setShowHelp(false)} aria-label="Cerrar instrucciones"><ExternalLink size={14} /> Entendido</button>
    </div>}
  </div>;

  return <div className={`pwa-install ${compact ? "pwa-install-compact" : ""}`}>
    <button type="button" className={compact ? "button button-small" : "button"} onClick={install}><Download size={17} /> Instalar la app</button>
    {showHelp && <div className="pwa-install-help" role="status"><strong>Instalación segura</strong><span>{instructions}</span><small>El sistema solicitará tu confirmación. No se instala nada sin tu permiso.</small>{message && <small>{message}</small>}<button type="button" onClick={() => setShowHelp(false)} aria-label="Cerrar instrucciones"><ExternalLink size={14} /> Entendido</button></div>}
  </div>;
}
