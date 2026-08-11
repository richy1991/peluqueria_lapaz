import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { ProductCatalog } from "@/components/product-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicData, getPublicProducts } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [{ business }, products] = await Promise.all([getPublicData(), getPublicProducts()]);
  return <>
    <SiteHeader />
    <main className="public-collection-page" id="productos">
      <section className="collection-hero"><div className="container"><p className="eyebrow">CATÁLOGO LEGEND</p><PackageCheck/><h1>Productos disponibles.</h1><p>Solo mostramos artículos activos y con existencias para reservar.</p><Link className="text-link" href="/#productos"><ArrowLeft/> Volver al inicio</Link></div></section>
      <section className="section"><div className="container"><ProductCatalog products={products}/></div></section>
    </main>
    <SiteFooter business={business}/>
  </>;
}
