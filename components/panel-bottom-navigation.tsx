"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type PanelNavigationItem = {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
};

type PanelBottomNavigationProps = {
  items: PanelNavigationItem[];
  activeId: string;
  className: string;
  ariaLabel: string;
  replace?: boolean;
};

/** Gives the selected tab immediate feedback while the route transition is pending. */
export function PanelBottomNavigation({ items, activeId, className, ariaLabel, replace = false }: PanelBottomNavigationProps) {
  const [visualActiveId, setVisualActiveId] = useState(activeId);
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => setVisualActiveId(activeId), [activeId]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const moveIndicator = () => {
      const activeLink = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[data-panel-nav-id]"))
        .find((link) => link.dataset.panelNavId === visualActiveId);
      if (!activeLink) return;
      const navBounds = nav.getBoundingClientRect();
      const linkBounds = activeLink.getBoundingClientRect();
      indicator.style.transform = `translate3d(${linkBounds.left + linkBounds.width / 2 - navBounds.left - 4}px,0,0)`;
    };

    moveIndicator();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(moveIndicator);
    observer?.observe(nav);
    window.addEventListener("resize", moveIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", moveIndicator);
    };
  }, [visualActiveId]);

  return <nav ref={navRef} className={`panel-bottom-nav panel-animated-bottom-nav ${className}`} aria-label={ariaLabel}>
    {items.map((item) => {
      const active = visualActiveId === item.id;
      return <Link
        key={item.id}
        href={item.href}
        replace={replace}
        data-panel-nav-id={item.id}
        aria-label={item.label}
        aria-current={activeId === item.id ? "page" : undefined}
        className={active ? "active" : ""}
        onPointerDown={() => setVisualActiveId(item.id)}
        onFocus={() => setVisualActiveId(item.id)}
      >
        {item.icon}<span>{item.label}</span><i aria-hidden="true" />
      </Link>;
    })}
    <span ref={indicatorRef} className="panel-nav-active-indicator" aria-hidden="true" />
  </nav>;
}
