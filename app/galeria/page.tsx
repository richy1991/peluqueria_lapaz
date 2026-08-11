import Link from "next/link";
import { ArrowLeft, ExternalLink, Images } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicData, getPublicGallery } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [{ business }, gallery] = await Promise.all([getPublicData(), getPublicGallery()]);
  return <>
    <SiteHeader />
    <main className="public-collection-page">
      <section className="collection-hero"><div className="container"><p className="eyebrow">GALERÍA LEGEND</p><Images/><h1>Estilos y trabajos.</h1><p>Trabajos realizados por el equipo y referencias visuales acreditadas.</p><Link className="text-link" href="/#galeria"><ArrowLeft/> Volver al inicio</Link></div></section>
      <section className="section"><div className="container public-gallery-grid">{gallery.map((item)=><article key={item.id}><div style={{backgroundImage:`url(${item.image})`}} role="img" aria-label={item.title}/><h2>{item.title}</h2>{"barberName" in item&&item.barberName&&<p>Publicado por {item.barberName}</p>}{"sourceType" in item&&item.sourceType==="reference"&&item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer">Ver fuente <ExternalLink/></a>}</article>)}</div></section>
    </main>
    <SiteFooter business={business}/>
  </>;
}
