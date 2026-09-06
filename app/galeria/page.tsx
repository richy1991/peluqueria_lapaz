import Link from "next/link";
import { ArrowLeft, Images } from "lucide-react";
import { GalleryCatalog } from "@/components/gallery-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicData, getPublicGallery } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [{ business }, gallery] = await Promise.all([getPublicData(), getPublicGallery()]);
  return <>
    <SiteHeader />
    <main className="public-collection-page">
      <section className="collection-hero"><div className="container"><p className="eyebrow">GALERÍA LEGEND</p><Images/><h1>Estilos y trabajos.</h1><p>Trabajos realizados por el equipo y referencias visuales acreditadas.</p><Link replace className="text-link" href="/#galeria"><ArrowLeft/> Volver al inicio</Link></div></section>
      <section className="section"><div className="container"><GalleryCatalog items={gallery}/></div></section>
    </main>
    <SiteFooter business={business}/>
  </>;
}
