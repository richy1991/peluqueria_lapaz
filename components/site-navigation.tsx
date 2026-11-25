"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

const sections = [
  { id: "servicios", label: "Servicios" },
  { id: "equipo", label: "Equipo" },
  { id: "galeria", label: "Galería" },
  { id: "productos", label: "Productos" },
  { id: "visitanos", label: "Visítanos" },
] as const;

export type PublicSection = typeof sections[number]["id"];

export function SiteNavigation({ onHome, currentPage, brand, account }: {
  onHome: boolean;
  currentPage?: PublicSection;
  brand: ReactNode;
  account?: ReactNode;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [activeSection, setActiveSection] = useState<PublicSection>();

  useEffect(() => {
    if (!onHome) return;
    const visibleSections = sections.map(({ id }) => ({ id, element: document.getElementById(id) }));
    let frame = 0;

    function updateNavigation() {
      frame = 0;
      const readingLine = (headerRef.current?.offsetHeight ?? 0) + Math.min(72, window.innerHeight * .12);
      let current: PublicSection | undefined;
      for (const { id, element } of visibleSections) {
        if (element && element.getBoundingClientRect().top <= readingLine) current = id;
      }
      setActiveSection(current);
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateNavigation);
    }

    function updateHash() {
      scheduleUpdate();
      if (window.location.hash === "#notificaciones") {
        headerRef.current?.querySelector<HTMLDetailsElement>("details#notificaciones")?.setAttribute("open", "");
      }
    }

    updateHash();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", updateHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", updateHash);
    };
  }, [onHome]);

  useEffect(() => {
    function openAccountMenu() {
      return headerRef.current?.querySelector<HTMLDetailsElement>(".site-account-actions > details[open]");
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const menu = openAccountMenu();
      if (menu && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
      if (event.target instanceof Element && event.target.closest(".site-header .brand")) {
        menuRef.current?.removeAttribute("open");
        if (onHome && event.button === 0 && !event.defaultPrevented
          && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          if (window.location.hash !== "#top") window.history.pushState(null, "", "#top");
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const menu = openAccountMenu();
      if (!menu) return;
      const restoreFocus = menu.contains(document.activeElement);
      menu.open = false;
      if (restoreFocus) menu.querySelector("summary")?.focus();
    }

    document.addEventListener("click", closeOnOutsideClick, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onHome]);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  const sectionLinks = (mobile = false) => sections.map(({ id, label }) => {
    const current = onHome ? (activeSection === id ? "location" : undefined) : (currentPage === id ? "page" : undefined);
    return onHome
      ? <a key={id} href={`#${id}`} aria-current={current} onClick={mobile ? closeMenu : undefined}>{label}</a>
      : <Link key={id} href={currentPage === id ? `/${id}` : `/#${id}`} aria-current={current} onClick={mobile ? closeMenu : undefined}>{label}</Link>;
  });

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        {brand}
        <nav className="desktop-nav" aria-label="Navegación principal">
          {sectionLinks()}
          <Link className="header-book" href="/reservar" prefetch>Reservar cita</Link>
        </nav>
        {account ?? <Link className="header-login" href="/login">Iniciar sesión</Link>}
        <details className="mobile-menu" ref={menuRef} name="legend-header-actions" suppressHydrationWarning>
          <summary aria-label="Abrir menú"><Menu size={22} /></summary>
          <nav aria-label="Navegación móvil">
            {sectionLinks(true)}
            <Link href="/reservar" onClick={closeMenu}>Reservar cita</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
