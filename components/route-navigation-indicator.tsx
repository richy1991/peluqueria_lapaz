"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteNavigationIndicator() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.removeAttribute("data-route-pending");
  }, [pathname]);

  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      document.documentElement.dataset.routePending = "true";
    };
    window.addEventListener("click", start, true);
    return () => window.removeEventListener("click", start, true);
  }, []);

  return null;
}
