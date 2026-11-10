"use client";

import {
  createContext,
  type CSSProperties,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LogOut, Menu, Monitor, Moon, Palette, Sun, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FloatingSupportChat } from "@/components/floating-support-chat";
import { DashboardToastHost } from "@/components/dashboard-toast";
import { PanelExitGuard } from "@/components/panel-exit-guard";
import { createClient } from "@/lib/supabase/client";
import { useScrollDirection } from "@/hooks/useScrollDirection";

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

function subscribeToMobileViewport(callback: () => void) {
  const media = window.matchMedia("(max-width: 760px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function mobileViewportSnapshot() {
  return window.matchMedia("(max-width: 760px)").matches;
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

  const options = <div className="panel-theme-options" role="group" aria-label="Seleccionar tema">
    <button type="button" title="Usar tema del sistema" aria-label="Usar tema del sistema" aria-pressed={preference === "system"} className={preference === "system" ? "active" : ""} onClick={() => choose("system")}><Monitor /><span>Sistema</span></button>
    <button type="button" title="Usar tema claro" aria-label="Usar tema claro" aria-pressed={preference === "light"} className={preference === "light" ? "active" : ""} onClick={() => choose("light")}><Sun /><span>Claro</span></button>
    <button type="button" title="Usar tema oscuro" aria-label="Usar tema oscuro" aria-pressed={preference === "dark"} className={preference === "dark" ? "active" : ""} onClick={() => choose("dark")}><Moon /><span>Oscuro</span></button>
  </div>;

  if (compact) {
    return <div className="panel-theme-selector compact">{options}</div>;
  }

  return (
    <details ref={detailsRef} className="panel-theme-selector">
      <summary aria-label="Seleccionar apariencia">
        <Palette />
      </summary>
      {options}
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
    if (!window.confirm("¿Seguro que quieres salir de la aplicación? Puedes quedarte un poco más para continuar usando LEGEND CLUB.")) return;
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

  const className = `panel-theme panel-viewport-layer ${chromeHidden && !open ? "panel-mobile-chrome-hidden" : ""} ${open ? "mobile-nav-open" : ""} ${chatInHeader ? "panel-chat-in-header" : ""}`;
  return createPortal(<div className={className} data-panel-theme={theme}>{children}</div>, document.body);
}

export function PanelResponsiveSidebar({ children, variant = "operations" }: { children: ReactNode; variant?: "client" | "operations" }) {
  const mobile = useSyncExternalStore(subscribeToMobileViewport, mobileViewportSnapshot, () => false);
  const shellClass = variant === "client" ? "panel-client-shell" : "admin-shell";
  const sidebar = <div className={`panel-sidebar-viewport-overlays ${shellClass}`}>{children}</div>;
  return mobile ? <PanelViewportPortal>{sidebar}</PanelViewportPortal> : sidebar;
}

export function PanelExperience({ children, chatInHeader = false }: { children: ReactNode; chatInHeader?: boolean }) {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [, resolved] = value.split(":") as [Preference, "light" | "dark"];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileViewport = useSyncExternalStore(subscribeToMobileViewport, mobileViewportSnapshot, () => false);
  const { scrollDirection, scrollY } = useScrollDirection(10, mobileViewport && !mobileNavOpen);
  const chromeHidden = mobileViewport && !mobileNavOpen && scrollY > 32 && scrollDirection === "down";
  const headerScrollY = mobileViewport ? scrollY : 0;
  const headerProgress = Math.min(1, Math.max(0, headerScrollY / 200));
  const headerStyle = {
    "--panel-header-height": `${280 - 140 * headerProgress}px`,
    "--panel-header-title-size": `${48 - 20 * headerProgress}px`,
    "--panel-header-subtitle-opacity": `${1 - Math.min(1, headerScrollY / 100)}`,
    "--panel-header-radius": `${24 * headerProgress}px`,
    "--panel-header-content-gap": `${26 - 20 * headerProgress}px`,
    "--panel-header-bottom-padding": `${16 - 8 * headerProgress}px`,
    "--panel-header-padding": `${40 - 20 * headerProgress}px`,
    "--panel-header-eyebrow-height": `${headerScrollY >= 110 ? 0 : 18}px`,
    "--panel-header-subtitle-height": `${headerScrollY >= 100 ? 0 : 56}px`,
  } as CSSProperties;

  useEffect(() => {
    const themedPanel = document.querySelector<HTMLElement>(".panel-client-shell, .admin-shell");
    const computedTheme = themedPanel ? getComputedStyle(themedPanel) : null;
    const themeColor = computedTheme?.getPropertyValue("--app-theme-color").trim()
      || computedTheme?.getPropertyValue("--dash-bg").trim()
      || (resolved === "dark" ? "#070b11" : "#eef4f7");
    const root = document.documentElement;
    const previousRootTheme = root.dataset.panelTheme;
    const previousBodyTheme = document.body.dataset.panelTheme;
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const previousColor = meta.content;
    root.dataset.panelTheme = resolved;
    document.body.dataset.panelTheme = resolved;
    root.style.backgroundColor = themeColor;
    document.body.style.backgroundColor = themeColor;
    meta.content = themeColor;
    return () => {
      if (previousRootTheme) root.dataset.panelTheme = previousRootTheme;
      else delete root.dataset.panelTheme;
      if (previousBodyTheme) document.body.dataset.panelTheme = previousBodyTheme;
      else delete document.body.dataset.panelTheme;
      root.style.backgroundColor = previousRootBackground;
      document.body.style.backgroundColor = previousBodyBackground;
      meta!.content = previousColor;
    };
  }, [resolved]);

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
    chatInHeader,
  };

  return (
    <MobileNavigationContext.Provider value={navigation}>
      <div className={`panel-theme ${chromeHidden && !mobileNavOpen ? "panel-mobile-chrome-hidden" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""} ${chatInHeader ? "panel-chat-in-header" : ""}`} data-panel-theme={resolved} style={headerStyle} suppressHydrationWarning>
        {children}
        <PanelExitGuard />
        <DashboardToastHost />
        <PanelViewportPortal><aside className="panel-floating-tools" aria-label="Atención al cliente"><FloatingSupportChat /></aside></PanelViewportPortal>
      </div>
    </MobileNavigationContext.Provider>
  );
}
