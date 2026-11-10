"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type WorkCarouselItem = { id: string; title: string; image: string };

/** A lightweight, CSS-driven carousel so each slide stays responsive without another runtime dependency. */
export function WorkCarousel({ items, href }: { items: WorkCarouselItem[]; href: string }) {
  const slides = items.slice(0, 6);
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  if (!slides.length) return <p className="portal-empty work-carousel-empty">Pronto compartiremos nuevos trabajos del equipo.</p>;

  const activeIndex = ((page % slides.length) + slides.length) % slides.length;
  const item = slides[activeIndex];
  const paginate = (newDirection: number) => setPage([activeIndex + newDirection, newDirection]);

  return <div className="work-carousel" role="region" aria-roledescription="carrusel" aria-label="Inspiración Legend">
    <div className="work-carousel-viewport">
      <Link
        key={item.id}
        href={href}
        className={`work-carousel-slide ${direction < 0 ? "enters-from-left" : "enters-from-right"}`}
        style={{ backgroundImage: `linear-gradient(0deg,rgba(13,13,13,.84),rgba(13,13,13,.12) 58%,transparent),url(${JSON.stringify(item.image)})` }}
        aria-label={`Ver trabajo: ${item.title}`}
        aria-live="polite"
      >
        <span>{item.title}</span>
        <strong>Ver trabajo</strong>
      </Link>
    </div>
    <div className="work-carousel-controls">
      <div className="work-carousel-dots" aria-label="Seleccionar trabajo">
        {slides.map((slide, index) => <button
          key={slide.id}
          type="button"
          className={index === activeIndex ? "active" : ""}
          aria-label={`Mostrar trabajo ${index + 1}`}
          aria-current={index === activeIndex}
          onClick={() => setPage([index, index > activeIndex ? 1 : -1])}
        />)}
      </div>
      <div className="work-carousel-arrows">
        <button type="button" aria-label="Trabajo anterior" onClick={() => paginate(-1)}><ChevronLeft /></button>
        <button type="button" aria-label="Trabajo siguiente" onClick={() => paginate(1)}><ChevronRight /></button>
      </div>
    </div>
  </div>;
}
