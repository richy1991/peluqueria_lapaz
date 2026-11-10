"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, PackageCheck, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import type { PublicProduct } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/client";
import { useNativeOverlay } from "@/components/use-native-overlay";

const pendingProductKey = "legend_club_pending_product";
const productCartKey = "legend_club_product_cart";

type CartLine = { productId: string; quantity: number };
export type ProductReservationSummary = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  expiresAt: string;
};

export function ProductCatalog({ products, variant = "catalog", reservations }: { products: PublicProduct[]; variant?: "home" | "catalog"; reservations?: ProductReservationSummary[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [cancelBusyId, setCancelBusyId] = useState("");
  const [cancelledReservationIds, setCancelledReservationIds] = useState<string[]>([]);
  const [reservationFeedback, setReservationFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const closeOverlay = useNativeOverlay(Boolean(selected || cartOpen), () => { setSelected(null); setCartOpen(false); }, "product");

  const reserveProduct = useCallback(async (productId: string, quantity = 1) => {
    setBusyId(productId);
    setMessage("");
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.sessionStorage.setItem(pendingProductKey, JSON.stringify({ productId, quantity }));
      const returnPath = `${window.location.pathname}?product_auth=complete#productos`;
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;
      const { data, error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
      if (authError) { setError(authError.message); setBusyId(""); return; }
      if (data.url) window.location.replace(data.url);
      else { setError("No pudimos abrir el acceso con Google."); setBusyId(""); }
      return;
    }
    const { error: reservationError } = await supabase.rpc("reserve_product", { p_product_id: productId, p_quantity: quantity });
    setBusyId("");
    if (reservationError) return setError(reservationError.message);
    setCart((items) => items.filter((item) => item.productId !== productId));
    setMessage("Producto apartado durante 24 horas. Preséntate en el local para recogerlo y pagar.");
    router.refresh();
  }, [router]);

  async function cancelReservation(reservation: ProductReservationSummary) {
    if (!window.confirm(`¿Cancelar el apartado de ${reservation.productName}?`)) return;
    setCancelBusyId(reservation.id);
    setReservationFeedback("");
    try {
      const { error: cancellationError } = await createClient().rpc("cancel_my_product_reservation", { p_reservation_id: reservation.id });
      if (cancellationError) {
        setReservationFeedback(cancellationError.message);
        router.refresh();
        return;
      }
      setCancelledReservationIds((ids) => [...ids, reservation.id]);
      setReservationFeedback("Apartado cancelado. El producto ya no está reservado.");
      router.refresh();
    } catch {
      setReservationFeedback("No pudimos cancelar el apartado. Inténtalo otra vez.");
    } finally {
      setCancelBusyId("");
    }
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(productCartKey);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        setCart(parsed.filter((item): item is CartLine => typeof item?.productId === "string" && Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 10));
      }
    } catch {
      setCart([]);
    }
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    try { window.localStorage.setItem(productCartKey, JSON.stringify(cart)); } catch { /* El carrito sigue disponible durante esta visita. */ }
  }, [cart, cartReady]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("product_auth") !== "complete") return;
    const pending = window.sessionStorage.getItem(pendingProductKey);
    if (!pending) return;
    window.sessionStorage.removeItem(pendingProductKey);
    let productId = pending;
    let quantity = 1;
    try {
      const parsed = JSON.parse(pending) as { productId?: unknown; quantity?: unknown };
      if (typeof parsed.productId === "string") productId = parsed.productId;
      if (typeof parsed.quantity === "number" && Number.isInteger(parsed.quantity)) quantity = parsed.quantity;
    } catch { /* Compatibilidad con un apartado pendiente creado por una version anterior. */ }
    const task = window.setTimeout(() => void reserveProduct(productId, quantity), 0);
    return () => window.clearTimeout(task);
  }, [reserveProduct]);

  useEffect(() => {
    if (!selected && !cartOpen) return;
    document.body.classList.add("catalog-modal-open");
    return () => {
      document.body.classList.remove("catalog-modal-open");
    };
  }, [selected, cartOpen]);

  function openProduct(product: PublicProduct) { setSelected(product); setCartOpen(false); setImageIndex(0); }
  function addToCart(product: PublicProduct) {
    if (!product.stock) return;
    setCart((items) => {
      const current = items.find((item) => item.productId === product.id);
      if (current && current.quantity >= Math.min(product.stock, 10)) return items;
      return current
        ? items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { productId: product.id, quantity: 1 }];
    });
    setMessage(`${product.name} se agreg\u00f3 al carrito.`);
    setSelected(null);
  }
  function updateCartQuantity(product: PublicProduct, quantity: number) {
    const nextQuantity = Math.min(Math.max(quantity, 1), Math.max(1, Math.min(product.stock, 10)));
    setCart((items) => items.map((item) => item.productId === product.id ? { ...item, quantity: nextQuantity } : item));
  }
  const visibleReservations = (reservations ?? []).filter((reservation) => !cancelledReservationIds.includes(reservation.id));
  if (!products.length && reservations === undefined) return <p className="catalog-empty">Pronto publicaremos nuestros productos disponibles.</p>;
  const selectedImages = selected?.images.length ? selected.images : selected?.image ? [selected.image] : [];
  const cartItems = cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: Math.min(item.quantity, Math.max(1, Math.min(product.stock, 10))) }] : [];
  });
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.quantity * item.product.price, 0);
  const reservedQuantity = visibleReservations.reduce((total, item) => total + item.quantity, 0);
  const cartDisplayCount = cartCount + reservedQuantity;

  return <>
    {message && <p className="catalog-message">{message}</p>}
    {error && <p className="catalog-error">{error}</p>}
    {variant === "catalog" && <div className="product-cart-bar">
      <div><ShoppingCart /><span><strong>Tu carrito</strong><small>{cartCount ? `${cartCount} seleccionado(s) · ${visibleReservations.length} apartado(s)` : visibleReservations.length ? `${visibleReservations.length} apartado(s) activo(s)` : "A\u00fan est\u00e1 vac\u00edo"}</small></span></div>
      <button type="button" onClick={() => { setSelected(null); setCartOpen(true); }} aria-label={`Abrir carrito, ${cartCount} seleccionados y ${visibleReservations.length} apartados`}><span>Ver carrito</span><b>{cartDisplayCount}</b></button>
    </div>}
    <div className={`product-grid product-grid-${variant}`}>
      {products.length ? products.map((product) => <button className="product-card" key={product.id} type="button" onClick={() => openProduct(product)} aria-label={`Ver detalles de ${product.name}`}>
        <span className={`product-photo ${product.image ? "" : "product-placeholder"}`} style={product.image ? { backgroundImage: `url(${product.image})` } : undefined}>
          {!product.image && <PackageCheck size={38} />}{product.images.length > 1 && <i>{product.images.length} fotos</i>}
        </span>
        <span className="tag">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p>
        <span className="product-meta"><strong>Bs {product.price}</strong><span>{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</span></span>
      </button>) : <p className="catalog-empty">Pronto publicaremos nuevos productos disponibles.</p>}
    </div>

    {selected && <div className="catalog-modal" role="dialog" aria-modal="true" aria-label={`Detalles de ${selected.name}`} onMouseDown={(event) => event.target === event.currentTarget && closeOverlay()}>
      <article>
        <button className="catalog-modal-close" type="button" onClick={closeOverlay} aria-label="Cerrar"><X /></button>
        <div className="catalog-modal-media">
          {selectedImages[imageIndex] ? <Image src={selectedImages[imageIndex]} alt={`${selected.name}, foto ${imageIndex + 1}`} fill sizes="(max-width: 800px) 100vw, 520px" unoptimized /> : <PackageCheck />}
          {selectedImages.length > 1 && <><button type="button" className="catalog-arrow previous" onClick={() => setImageIndex((imageIndex - 1 + selectedImages.length) % selectedImages.length)} aria-label="Foto anterior"><ChevronLeft /></button><button type="button" className="catalog-arrow next" onClick={() => setImageIndex((imageIndex + 1) % selectedImages.length)} aria-label="Foto siguiente"><ChevronRight /></button><span className="catalog-counter">{imageIndex + 1}/{selectedImages.length}</span></>}
        </div>
        <div className="catalog-modal-copy">
          <span className="tag">{selected.category}</span><h2>{selected.name}</h2><p>{selected.description}</p>
          <dl><div><dt>Marca</dt><dd>{selected.brand || "No especificada"}</dd></div><div><dt>Presentación</dt><dd>{selected.presentation || "No especificada"}</dd></div><div><dt>Cantidad disponible</dt><dd>{selected.stock}</dd></div><div><dt>Precio</dt><dd>Bs {selected.price}</dd></div></dl>
          {variant === "catalog" && <div className="product-detail-actions"><button className="button button-cart-add" type="button" disabled={!selected.stock} onClick={() => addToCart(selected)}><ShoppingCart /> Agregar al carrito</button></div>}
          <button className="button button-dark" type="button" disabled={!selected.stock || busyId === selected.id} onClick={() => reserveProduct(selected.id)}>{busyId === selected.id ? "Procesando…" : "Apartar por 24 horas"}</button>
        </div>
      </article>
    </div>}
    {variant === "catalog" && cartOpen && <div className="catalog-modal catalog-cart-modal" role="dialog" aria-modal="true" aria-label="Tu carrito de productos" onMouseDown={(event) => event.target === event.currentTarget && closeOverlay()}>
      <article>
        <button className="catalog-modal-close" type="button" onClick={closeOverlay} aria-label="Cerrar carrito"><X /></button>
        <div className="catalog-cart-content">
          <div className="catalog-cart-heading"><ShoppingCart /><div><small>SELECCI&#211;N DE PRODUCTOS</small><h2>Tu carrito</h2></div></div>
          {cartItems.length ? <>
            <div className="catalog-cart-list">{cartItems.map(({ product, quantity }) => <article key={product.id}>
              <div className={`catalog-cart-thumb ${product.image ? "has-image" : ""}`} style={product.image ? { backgroundImage: `url(${JSON.stringify(product.image)})` } : undefined}>{!product.image && <PackageCheck />}</div>
              <div className="catalog-cart-item-copy"><strong>{product.name}</strong><small>Bs {product.price} · {product.stock} disponibles</small><div className="catalog-cart-item-actions">
                <div className="catalog-cart-quantity" role="group" aria-label={`Cantidad de ${product.name}`}><button type="button" disabled={quantity <= 1} onClick={() => updateCartQuantity(product, quantity - 1)} aria-label="Restar una unidad"><Minus /></button><b>{quantity}</b><button type="button" disabled={quantity >= Math.min(product.stock, 10)} onClick={() => updateCartQuantity(product, quantity + 1)} aria-label="Agregar una unidad"><Plus /></button></div>
                <button className="catalog-cart-remove" type="button" onClick={() => setCart((items) => items.filter((item) => item.productId !== product.id))} aria-label={`Quitar ${product.name} del carrito`}><Trash2 /> Quitar</button>
              </div></div>
              <strong className="catalog-cart-line-total">Bs {(product.price * quantity).toFixed(2)}</strong>
              <button className="button catalog-cart-reserve" type="button" disabled={!product.stock || busyId === product.id} onClick={() => reserveProduct(product.id, quantity)}>{busyId === product.id ? "Procesando..." : product.stock ? "Apartar" : "Agotado"}</button>
            </article>)}</div>
            <div className="catalog-cart-total"><span>Total de la selecci&#243;n</span><strong>Bs {cartTotal.toFixed(2)}</strong></div>
            <p className="catalog-cart-note">El apartado dura 24 horas. El pago se realiza al recoger el producto en el local.</p>
          </> : <div className="catalog-cart-empty"><ShoppingCart /><strong>Tu carrito est&#225; vac&#237;o</strong><p>Abre un producto y agr&#233;galo aqu&#237; para tenerlo a mano.</p></div>}
          {reservations !== undefined && <section className="catalog-reservations" aria-label="Mis productos apartados">
            <div className="catalog-reservations-heading"><div><PackageCheck /><span><small>APARTADOS ACTIVOS</small><strong>Mis productos apartados</strong></span></div><b>{visibleReservations.length}</b></div>
            {reservationFeedback && <p className="catalog-reservation-feedback" aria-live="polite">{reservationFeedback}</p>}
            {visibleReservations.length ? <div className="catalog-reservation-list">{visibleReservations.map((reservation) => <article key={reservation.id}>
              <div><strong>{reservation.productName}</strong><span>{reservation.quantity} unidad(es) · Bs {(reservation.unitPrice * reservation.quantity).toFixed(2)}</span><small>Vence {new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.expiresAt))}</small></div>
              <button type="button" disabled={Boolean(cancelBusyId)} onClick={() => void cancelReservation(reservation)} aria-label={`Cancelar apartado de ${reservation.productName}`}>{cancelBusyId === reservation.id ? "Cancelando…" : "Cancelar"}</button>
            </article>)}</div> : <p className="catalog-reservations-empty">No tienes productos apartados activos.</p>}
          </section>}
          <button className="button catalog-cart-continue" type="button" onClick={closeOverlay}>Seguir viendo productos</button>
        </div>
      </article>
    </div>}
  </>;
}
