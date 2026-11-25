import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductCatalog } from "@/components/product-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicData } from "@/lib/public-data";
import "./products.css";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { business, products } = await getPublicData();
  return (
    <div className="public-products">
      <SiteHeader currentPage="productos" />
      <main>
        <section className="products-hero" aria-labelledby="products-heading">
          <div className="container">
            <Link className="products-back" href="/#productos">
              <ArrowLeft size={16} aria-hidden="true" /> Volver a la portada
            </Link>
            <h1 id="products-heading">Productos <em>Legend.</em></h1>
            <p>Apártalos por 24 horas y paga al recogerlos en la barbería.</p>
          </div>
        </section>
        <section className="products-catalog container" id="productos" aria-label="Productos disponibles">
          <ProductCatalog products={products} />
        </section>
      </main>
      <SiteFooter business={business} />
    </div>
  );
}
