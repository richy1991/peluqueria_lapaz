"use client";

import { useEffect, useRef, type ReactNode } from "react";

const revealTargets = [
  ".legend-divider > *",
  ".split-heading > div",
  ".section-heading > *",
  ".service-row",
  ".barber-card",
  ".gallery-item",
  ".product-grid-home > .product-card",
  ".catalog-empty",
  ".visit-image",
  ".visit-card",
  ".center-action",
  ".closing-cta > *",
  ".footer-grid > div",
  ".footer-bottom",
].join(", ");

const priceAnimationDuration = 800;
const priceShuffleDuration = 480;
const priceFrameInterval = 55;

export function HomePriceDigits({ value }: { value: number }) {
  const text = String(value);

  return (
    <span className="home-price-digits">
      <span>{text}</span>
      <span aria-hidden="true" data-home-price={text}>{text}</span>
    </span>
  );
}

function scramblePrice(target: Element, reducedMotion: MediaQueryList) {
  const digits = target.querySelector<HTMLElement>("[data-home-price]");
  const finalPrice = digits?.dataset.homePrice;
  if (!digits || !finalPrice || reducedMotion.matches) return;

  const digitCount = finalPrice.replace(/\D/g, "").length;
  const startedAt = performance.now();
  let timer: number;

  const showFinalPrice = () => {
    window.clearTimeout(timer);
    digits.textContent = finalPrice;
  };

  const update = () => {
    const elapsed = performance.now() - startedAt;
    if (elapsed >= priceAnimationDuration || reducedMotion.matches || target.matches(":focus-within")) {
      showFinalPrice();
      return;
    }

    const settleProgress = Math.max(0, (elapsed - priceShuffleDuration) / (priceAnimationDuration - priceShuffleDuration));
    let settledDigits = Math.floor(settleProgress * digitCount);
    digits.textContent = finalPrice.replace(/\d/g, (digit) => {
      if (settledDigits-- > 0) return digit;
      return String((Number(digit) + 1 + Math.floor(Math.random() * 9)) % 10);
    });
    timer = window.setTimeout(update, priceFrameInterval);
  };

  update();
  return showFinalPrice;
}

export function HomeScrollEffects({ children }: { children: ReactNode }) {
  const home = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!home.current || typeof IntersectionObserver === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const restorePrices = new Map<Element, () => void>();
    const resetObserver = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (isIntersecting) continue;
        target.setAttribute("data-home-reveal", "pending");
        restorePrices.get(target)?.();
        restorePrices.delete(target);
      }
    });
    // Wait until the element is well inside the viewport so its entrance
    // transform cannot send it back across the exit threshold.
    const entranceObserver = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting || target.getAttribute("data-home-reveal") !== "pending") continue;
        target.setAttribute("data-home-reveal", "entered");
        const restorePrice = scramblePrice(target, reducedMotion);
        if (restorePrice) restorePrices.set(target, restorePrice);
      }
    }, { rootMargin: "-56px 0px" });

    const targets = [...home.current.querySelectorAll(revealTargets)];

    for (const target of targets) {
      const bounds = target.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
        target.setAttribute("data-home-reveal", "pending");
      }
      resetObserver.observe(target);
      entranceObserver.observe(target);
    }

    return () => {
      resetObserver.disconnect();
      entranceObserver.disconnect();
      for (const restorePrice of restorePrices.values()) restorePrice();
      for (const target of targets) target.removeAttribute("data-home-reveal");
    };
  }, []);

  return <div className="public-home" ref={home}>{children}</div>;
}
