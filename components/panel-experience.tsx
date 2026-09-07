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
import { useRouter } from "next/navigation";
import { FloatingSupportChat } from "@/components/floating-support-chat";
import { DashboardToastHost } from "@/components/dashboard-toast";
import { createClient } from "@/lib/supabase/client";

type Preference = "system" | "light" | "dark";
const EVENT = "legend-panel-theme";
const MobileNavigationContext = createContext<{
  open: boolean;
  show: () => void;
  hide: () => void;
} | null>(null);

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

export function PanelExperience({ children, clientChatInHeader = false }: { children: ReactNode; clientChatInHeader?: boolean }) {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [, resolved] = value.split(":") as [Preference, "light" | "dark"];
  const [headerHidden, setHeaderHidden] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    let previous = window.scrollY;
    let ticking = false;
    function update() {
      const current = window.scrollY;
      const delta = current - previous;
      if (current < 24) {
        setHeaderHidden(false);
        previous = current;
      } else if (delta > 7 && current > 90) {
        setHeaderHidden(true);
        previous = current;
      } else if (delta < -7) {
        setHeaderHidden(false);
        previous = current;
      }
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navigation = {
    open: mobileNavOpen,
    show: () => {
      setHeaderHidden(false);
      setMobileNavOpen(true);
    },
    hide: () => setMobileNavOpen(false),
  };

  return (
    <MobileNavigationContext.Provider value={navigation}>
      <div className={`panel-theme ${headerHidden ? "panel-header-hidden" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""} ${clientChatInHeader ? "client-chat-in-header" : ""}`} data-panel-theme={resolved} suppressHydrationWarning>
        {children}
        <DashboardToastHost />
        <aside className="panel-floating-tools" aria-label="Atención al cliente"><FloatingSupportChat /></aside>
      </div>
    </MobileNavigationContext.Provider>
  );
}
