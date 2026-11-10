"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export type ScrollDirection = "up" | "down" | null;

/** Tracks scroll position once per animation frame and ignores movement below the threshold. */
export function useScrollDirection(threshold = 10, enabled = true) {
  const pathname = usePathname();
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);
  const reportedScrollY = useRef(0);
  const pendingDirection = useRef<Exclude<ScrollDirection, null> | null>(null);
  const pendingDistance = useRef(0);

  useEffect(() => {
    const readScrollY = () => Math.max(window.scrollY, document.documentElement.scrollTop);
    let frame: number | null = null;

    lastScrollY.current = readScrollY();
    reportedScrollY.current = lastScrollY.current;
    setScrollY(lastScrollY.current);
    setScrollDirection(null);

    if (!enabled) return;

    function measure() {
      frame = null;
      const current = readScrollY();
      const delta = current - lastScrollY.current;
      lastScrollY.current = current;

      if (Math.abs(current - reportedScrollY.current) >= threshold || current === 0) {
        reportedScrollY.current = current;
        setScrollY(current);
      }

      if (current <= threshold) {
        pendingDirection.current = null;
        pendingDistance.current = 0;
        setScrollDirection(null);
        return;
      }

      if (Math.abs(delta) < 1) return;
      const nextDirection = delta > 0 ? "down" : "up";
      if (pendingDirection.current !== nextDirection) {
        pendingDirection.current = nextDirection;
        pendingDistance.current = 0;
      }
      pendingDistance.current += Math.abs(delta);

      if (pendingDistance.current >= threshold) {
        setScrollDirection(nextDirection);
        pendingDistance.current = 0;
      }
    }

    function requestMeasure() {
      if (frame === null) frame = window.requestAnimationFrame(measure);
    }

    window.addEventListener("scroll", requestMeasure, { passive: true });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestMeasure);
    };
  }, [enabled, pathname, threshold]);

  return { scrollDirection, scrollY };
}
