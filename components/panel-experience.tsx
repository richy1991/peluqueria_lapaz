"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LogOut, Menu, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FloatingSupportChat } from "@/components/floating-support-chat";
import { DashboardToastHost } from "@/components/dashboard-toast";
import { createClient } from "@/lib/supabase/client";

type Preference = "system" | "light" | "dark";
const EVENT = "legend-panel-theme";
const MobileNavigationContext = createContext<{
  open: boolean;
  show: () => void;
  hide: () => void;
  theme: "light" | "dark";
  chromeHidden: boolean;
  chatInHeader: boolean;
} | null>(null);

function subscribeToBrowser() {
  return () => undefined;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

function snapshot(): `${Preference}:${"light" | "dark"}` {
  const saved = localStorage.getItem("legend-panel-theme");
  const preference: Preference = saved === "light" || saved === "dark" ? saved : "system";
  const resolved = preference === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : preference;
  return `${preference}:${resolved}`;
}

function serverSnapshot(): `${Preference}:${"light" | "dark"}` {
  return "system:light";
}

function getScrollTop() {
  return Math.max(window.scrollY, document.documentElement.scrollTop);
}

function useAutoHidePanelChrome(disabled: boolean) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 760px)");
    let previous = getScrollTop();
    let direction: -1 | 0 | 1 = 0;
    let distance = 0;
    let frame: number | null = null;

    function updateHidden(next: boolean) {
      if (hiddenRef.current === next) return;
      hiddenRef.current = next;
      setHidden(next);
    }

    function reset() {
      previous = getScrollTop();
      direction = 0;
      distance = 0;
      updateHidden(false);
    }

    function measure() {
      frame = null;
      const current = getScrollTop();

      if (disabled || !mobileViewport.matches || current <= 32) {
        previous = current;
        direction = 0;
        distance = 0;
        updateHidden(false);
        return;
      }

      const delta = current - previous;
      previous = current;
      if (Math.abs(delta) < 1) return;

      const nextDirection: -1 | 1 = delta > 0 ? 1 : -1;
      if (nextDirection !== direction) {
        direction = nextDirection;
        distance = 0;
      }
      distance += Math.abs(delta);

      if (direction === 1 && current > 96 && distance >= 16) {
        distance = 0;
        updateHidden(true);
      } else if (direction === -1 && distance >= 10) {
        distance = 0;
        updateHidden(false);
      }
    }

    function requestMeasure() {
      if (frame === null) frame = window.requestAnimationFrame(measure);
    }

    reset();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("pageshow", reset);
    mobileViewport.addEventListener("change", reset);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("pageshow", reset);
      mobileViewport.removeEventListener("change", reset);
    };
  }, [disabled, pathname]);

  return hidden;
}

function selectTheme(next: Preference) {
  if (next === "system") localStorage.removeItem("legend-panel-theme");
  else localStorage.setItem("legend-panel-theme", next);
  window.dispatchEvent(new Event(EVENT));
}

export function PanelThemeSelector({ compact = false }: { compact?: boolean }) {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [preference] = value.split(":") as [Preference, "light" | "dark"];
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function choose(next: Preference) {
    selectTheme(next);
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <details ref={detailsRef} className={`panel-theme-selector ${compact ? "compact" : ""}`}>
      <summary aria-label="Seleccionar apariencia">
        <Palette />
      </summary>
      <div className="panel-theme-options" role="group" aria-label="Seleccionar tema">
        <button type="button" title="Usar tema del sistema" aria-label="Usar tema del sistema" aria-pressed={preference === "system"} className={preference === "system" ? "active" : ""} onClick={() => choose("system")}><Monitor /></button>
        <button type="button" title="Usar tema claro" aria-label="Usar tema claro" aria-pressed={preference === "light"} className={preference === "light" ? "active" : ""} onClick={() => choose("light")}><Sun /></button>
        <button type="button" title="Usar tema oscuro" aria-label="Usar tema oscuro" aria-pressed={preference === "dark"} className={preference === "dark" ? "active" : ""} onClick={() => choose("dark")}><Moon /></button>
      </div>
    </details>
  );
}

function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) throw new Error("Los controles móviles deben estar dentro de PanelExperience");
  return context;
}

export function PanelMobileMenuButton() {
  const { open, show } = useMobileNavigation();
  return <button className="mobile-nav-toggle" type="button" onClick={show} aria-label="Abrir menú lateral" aria-expanded={open}><Menu /></button>;
}

export function PanelMobileSidebarClose() {
  const { hide } = useMobileNavigation();
  return <button className="mobile-sidebar-close" type="button" onClick={hide} aria-label="Cerrar menú lateral"><X /></button>;
}

export function PanelMobileScrim() {
  const { hide } = useMobileNavigation();
  return <button className="sidebar-scrim" type="button" onClick={hide} aria-label="Cerrar menú" />;
}

export function PanelMobileLogout() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return <button className="mobile-sidebar-logout" type="button" onClick={logout}><LogOut /><span>Cerrar sesión</span></button>;
}

export function PanelViewportPortal({ children }: { children: ReactNode }) {
  const { open, theme, chromeHidden, chatInHeader } = useMobileNavigation();
  const browserReady = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  if (!browserReady) return null;

  const className = `panel-theme panel-viewport-layer ${chromeHidden && !open ? "panel-mobile-chrome-hidden" : ""} ${open ? "mobile-nav-open" : ""} ${chatInHeader ? "client-chat-in-header" : ""}`;
  return createPortal(<div className={className} data-panel-theme={theme}>{children}</div>, document.body);
}

export function PanelExperience({ children, clientChatInHeader = false }: { children: ReactNode; clientChatInHeader?: boolean }) {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [, resolved] = value.split(":") as [Preference, "light" | "dark"];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const chromeHidden = useAutoHidePanelChrome(mobileNavOpen);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const closeAfterNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".dash-sidebar nav button,.dash-sidebar nav a,.admin-sidebar-profile")) setMobileNavOpen(false);
    };
    window.addEventListener("keydown", close);
    document.addEventListener("click", closeAfterNavigation);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
      document.removeEventListener("click", closeAfterNavigation);
    };
  }, [mobileNavOpen]);

  const navigation = {
    open: mobileNavOpen,
    show: () => setMobileNavOpen(true),
    hide: () => setMobileNavOpen(false),
    theme: resolved,
    chromeHidden,
    chatInHeader: clientChatInHeader,
  };

  return (
    <MobileNavigationContext.Provider value={navigation}>
      <div className={`panel-theme ${chromeHidden && !mobileNavOpen ? "panel-mobile-chrome-hidden" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""} ${clientChatInHeader ? "client-chat-in-header" : ""}`} data-panel-theme={resolved} suppressHydrationWarning>
        {children}
        <DashboardToastHost />
        <PanelViewportPortal><aside className="panel-floating-tools" aria-label="Atención al cliente"><FloatingSupportChat /></aside></PanelViewportPortal>
      </div>
    </MobileNavigationContext.Provider>
  );
}
