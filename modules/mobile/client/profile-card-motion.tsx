"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ProfileCardMotion({ children, className }: { children: ReactNode; className: string }) {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!grid.current || typeof IntersectionObserver === "undefined") return;

    const cards = grid.current.querySelectorAll("[data-profile-card]");
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        target.toggleAttribute("data-profile-visible", isIntersecting);
      }
    }, { rootMargin: "-12px 24px -24px" });

    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return <div ref={grid} className={className}>{children}</div>;
}
