"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, PackageCheck, X } from "lucide-react";
import type { PublicProduct } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/client";

const pendingProductKey = "legend_club_pending_product";

export function ProductCatalog({ products, variant = "catalog" }: { products: PublicProduct[]; variant?: "home" | "catalog" }) {
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("product_auth") !== "complete") return;
    const productId = window.sessionStorage.getItem(pendingProductKey);
    if (!productId) return;
    window.sessionStorage.removeItem(pendingProductKey);
    void reserveProduct(productId);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.body.classList.add("catalog-modal-open");
    window.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("catalog-modal-open");
      window.removeEventListener("keydown", close);
    };
  }, [selected]);

  async function reserveProduct(productId: string) {
    setBusyId(productId);
    setMessage("");
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.sessionStorage.setItem(pendingProductKey, productId);
      const returnPath = `${window.location.pathname}?product_auth=complete#productos`;
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (authError) { setError(authError.message); setBusyId(""); }
      return;
    }
    const { error: reservationError } = await supabase.rpc("reserve_product", { p_product_id: productId, p_quantity: 1 });
    setBusyId("");
    if (reservationError) return setError(reservationError.message);
    setMessage("Producto apartado durante 24 horas. Preséntate en el local para recogerlo y pagar.");
  }

  function openProduct(product: PublicProduct) { setSelected(product); setImageIndex(0); }
  if (!products.length) return <p className="catalog-empty">Pronto publicaremos nuestros productos disponibles.</p>;
  const selectedImages = selected?.images.length ? selected.images : selected?.image ? [selected.image] : [];

  return <>
    {message && <p className="catalog-message">{message}</p>}
    {error && <p className="catalog-error">{error}</p>}
    <div className={`product-grid product-grid-${variant}`}>
      {products.map((product) => <button className="product-card" key={product.id} type="button" onClick={() => openProduct(product)} aria-label={`Ver detalles de ${product.name}`}>
        <span className={`product-photo ${product.image ? "" : "product-placeholder"}`} style={product.image ? { backgroundImage: `url(${product.image})` } : undefined}>
          {!product.image && <PackageCheck size={38} />}{product.images.length > 1 && <i>{product.images.length} fotos</i>}
        </span>
        <span className="tag">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p>
        <span className="product-meta"><strong>Bs {product.price}</strong><span>{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</span></span>
        <span className="button button-dark">Ver producto</span>
      </button>)}
    </div>

    {selected && <div className="catalog-modal" role="dialog" aria-modal="true" aria-label={`Detalles de ${selected.name}`} onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
      <article>
        <button className="catalog-modal-close" type="button" onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
        <div className="catalog-modal-media">
          {selectedImages[imageIndex] ? <Image src={selectedImages[imageIndex]} alt={`${selected.name}, foto ${imageIndex + 1}`} fill sizes="(max-width: 800px) 100vw, 520px" unoptimized /> : <PackageCheck />}
          {selectedImages.length > 1 && <><button type="button" className="catalog-arrow previous" onClick={() => setImageIndex((imageIndex - 1 + selectedImages.length) % selectedImages.length)} aria-label="Foto anterior"><ChevronLeft /></button><button type="button" className="catalog-arrow next" onClick={() => setImageIndex((imageIndex + 1) % selectedImages.length)} aria-label="Foto siguiente"><ChevronRight /></button><span className="catalog-counter">{imageIndex + 1}/{selectedImages.length}</span></>}
        </div>
        <div className="catalog-modal-copy">
          <span className="tag">{selected.category}</span><h2>{selected.name}</h2><p>{selected.description}</p>
          <dl><div><dt>Marca</dt><dd>{selected.brand || "No especificada"}</dd></div><div><dt>Presentación</dt><dd>{selected.presentation || "No especificada"}</dd></div><div><dt>Cantidad disponible</dt><dd>{selected.stock}</dd></div><div><dt>Precio</dt><dd>Bs {selected.price}</dd></div></dl>
          <button className="button button-dark" type="button" disabled={!selected.stock || busyId === selected.id} onClick={() => reserveProduct(selected.id)}>{busyId === selected.id ? "Procesando…" : "Apartar por 24 horas"}</button>
        </div>
      </article>
    </div>}
  </>;
}
