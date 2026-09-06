"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { PublicGalleryItem } from "@/lib/public-data";
import { useNativeOverlay } from "@/components/use-native-overlay";

export function GalleryCatalog({ items }: { items: PublicGalleryItem[] }) {
  const [selected, setSelected] = useState<PublicGalleryItem | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const closeGallery = useNativeOverlay(Boolean(selected), () => setSelected(null), "gallery");

  useEffect(() => {
    if (!selected) return;
    document.body.classList.add("catalog-modal-open");
    return () => { document.body.classList.remove("catalog-modal-open"); };
  }, [selected]);

  function open(item: PublicGalleryItem) { setSelected(item); setImageIndex(0); }
  const images = selected?.images.length ? selected.images : selected ? [selected.image] : [];

  return <>
    <div className="public-gallery-grid">
      {items.map((item) => <button type="button" key={item.id} onClick={() => open(item)} aria-label={`Ampliar ${item.title}`}>
        <span style={{backgroundImage:`url(${item.image})`}} role="img" aria-label={item.title}/><h2>{item.title}</h2>
        {item.barberName && <p>Publicado por {item.barberName}</p>}{item.images.length > 1 && <small>{item.images.length} fotos</small>}
      </button>)}
    </div>
    {selected && <div className="catalog-modal gallery-modal" role="dialog" aria-modal="true" aria-label={selected.title} onMouseDown={(event) => event.target === event.currentTarget && closeGallery()}>
      <article><button className="catalog-modal-close" type="button" onClick={closeGallery} aria-label="Cerrar"><X/></button>
        <div className="catalog-modal-media"><Image src={images[imageIndex]} alt={`${selected.title}, foto ${imageIndex + 1}`} fill sizes="(max-width: 800px) 100vw, 520px" unoptimized/>
          {images.length > 1 && <><button type="button" className="catalog-arrow previous" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} aria-label="Foto anterior"><ChevronLeft/></button><button type="button" className="catalog-arrow next" onClick={() => setImageIndex((imageIndex + 1) % images.length)} aria-label="Foto siguiente"><ChevronRight/></button><span className="catalog-counter">{imageIndex + 1}/{images.length}</span></>}
        </div>
        <div className="catalog-modal-copy"><span className="tag">PORTAFOLIO</span><h2>{selected.title}</h2>{selected.description && <p>{selected.description}</p>}{selected.barberName && <p><strong>Realizado por:</strong> {selected.barberName}</p>}{selected.sourceType === "reference" && selected.sourceUrl && <a className="text-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">Ver fuente <ExternalLink/></a>}</div>
      </article>
    </div>}
  </>;
}
