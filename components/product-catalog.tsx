"use client";

import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import type { PublicProduct } from "@/lib/public-data";
import { createClient } from "@/lib/supabase/client";

const pendingProductKey = "legend_club_pending_product";

export function ProductCatalog({ products }: { products: PublicProduct[] }) {
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("product_auth") !== "complete") return;
    const productId = window.sessionStorage.getItem(pendingProductKey);
    if (!productId) return;
    window.sessionStorage.removeItem(pendingProductKey);
    void reserveProduct(productId);
  }, []);

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
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (authError) {
        setError(authError.message);
        setBusyId("");
      }
      return;
    }

    const { error: reservationError } = await supabase.rpc("reserve_product", {
      p_product_id: productId,
      p_quantity: 1,
    });
    if (reservationError) {
      setError(reservationError.message);
    } else {
      setMessage("Producto apartado durante 24 horas. Preséntate en el local para recogerlo y pagar.");
    }
    setBusyId("");
  }

  if (!products.length) {
    return <p className="catalog-empty">Pronto publicaremos nuestros productos disponibles.</p>;
  }

  return (
    <>
      {message && <p className="catalog-message">{message}</p>}
      {error && <p className="catalog-error">{error}</p>}
      <div className="product-grid">
        {products.map((product) => (
          <article className="product-card" key={product.id}>
            <div
              className={`product-photo ${product.image ? "" : "product-placeholder"}`}
              style={product.image ? { backgroundImage: `url(${product.image})` } : undefined}
            >
              {!product.image && <PackageCheck size={38} />}
            </div>
            <span className="tag">{product.category}</span>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <div className="product-meta">
              <strong>Bs {product.price}</strong>
              <span>{product.stock > 0 ? `${product.stock} disponibles` : "Agotado"}</span>
            </div>
            <button
              className="button button-dark"
              disabled={!product.stock || busyId === product.id}
              onClick={() => reserveProduct(product.id)}
            >
              {busyId === product.id ? "Procesando…" : "Apartar por 24 horas"}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
